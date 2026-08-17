import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip } from './Tooltip'

interface Variable {
  key: string
  value: string | null
  is_secret: boolean
}

interface HistoryEntry {
  value: string
  caret: number
}

/** Keystrokes closer together than this collapse into one undo step. */
const COALESCE_MS = 500
const MAX_HISTORY = 200

interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  variables: Variable[]
  placeholder?: string
  className?: string
  multiline?: boolean
  syntax?: 'json'
  /**
   * Lets the parent rewrite a paste. Receives the value the field *would* have
   * after the paste is applied; return a replacement value, or undefined to
   * paste normally.
   */
  transformPastedValue?: (valueAfterPaste: string) => string | undefined
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightVariables(text: string, variables?: Variable[]): string {
  const escaped = escapeHtml(text)
  return escaped.replace(/\{(\w+)\}/g, (_match, key) => {
    const v = variables?.find((vr) => vr.key === key)
    const tooltip = v ? (v.is_secret ? '*******' : escapeHtml(v.value ?? '')) : ''
    return `<span class="rounded px-0.5 bg-op-tertiary/20 font-bold text-op-tertiary" data-tooltip="${tooltip}">{${escapeHtml(key)}}</span>`
  })
}

function highlightJson(text: string, variables?: Variable[]): string {
  // Tokenize JSON with a single regex that matches tokens in order
  const token =
    /(\{(\w+)\})|("(?:[^"\\]|\\.)*")\s*(?=:)|("(?:[^"\\]|\\.)*")|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false|null)\b|([{}[\]:,])|(\n)|(.)/g

  let result = ''
  let m: RegExpExecArray | null
  while ((m = token.exec(text)) !== null) {
    if (m[1]) {
      // Variable {word}
      const key = m[2]
      const v = variables?.find((vr) => vr.key === key)
      const tooltip = v ? (v.is_secret ? '*******' : escapeHtml(v.value ?? '')) : ''
      result += `<span class="rounded px-0.5 bg-op-tertiary/20 font-bold text-op-tertiary" data-tooltip="${tooltip}">${escapeHtml(m[1])}</span>`
    } else if (m[3]) {
      // JSON key (string followed by colon)
      result += `<span class="text-blue-400">${escapeHtml(m[3])}</span>`
    } else if (m[4]) {
      // JSON string value
      result += `<span class="text-green-400">${escapeHtml(m[4])}</span>`
    } else if (m[5]) {
      // Number
      result += `<span class="text-orange-400">${escapeHtml(m[5])}</span>`
    } else if (m[6]) {
      // Boolean / null
      result += `<span class="text-purple-400">${escapeHtml(m[6])}</span>`
    } else if (m[7]) {
      // Punctuation
      result += `<span class="text-white/40">${escapeHtml(m[7])}</span>`
    } else if (m[8]) {
      // Newline
      result += '\n'
    } else {
      // Whitespace or other
      result += escapeHtml(m[0])
    }
  }
  return result
}

/** Offsets of the current selection within `el`, as plain-text character indices. */
function getSelectionOffsets(el: HTMLElement): { start: number; end: number } {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 }
  const range = sel.getRangeAt(0)
  const before = range.cloneRange()
  before.selectNodeContents(el)
  before.setEnd(range.startContainer, range.startOffset)
  const start = before.toString().length
  return { start, end: start + range.toString().length }
}

function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0).cloneRange()
  range.selectNodeContents(el)
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
  return range.toString().length
}

function setCaretOffset(el: HTMLElement, offset: number): void {
  const sel = window.getSelection()
  if (!sel) return

  let remaining = offset

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      if (remaining <= len) {
        const range = document.createRange()
        range.setStart(node, remaining)
        range.collapse(true)
        sel!.removeAllRanges()
        sel!.addRange(range)
        return true
      }
      remaining -= len
    } else {
      for (const child of node.childNodes) {
        if (walk(child)) return true
      }
    }
    return false
  }

  if (!walk(el)) {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

export function VariableInput({
  value,
  onChange,
  variables,
  placeholder,
  className = '',
  multiline = false,
  syntax,
  transformPastedValue
}: VariableInputProps): React.JSX.Element {
  const highlight = (text: string): string =>
    syntax === 'json' ? highlightJson(text, variables) : highlightVariables(text, variables)

  const editorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdown, setDropdown] = useState<{ query: string; rect: DOMRect } | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const caretRef = useRef<number>(0)
  const isComposing = useRef(false)
  const skipNextInput = useRef(false)
  const internalValue = useRef(value)
  const initialised = useRef(false)

  // Re-highlighting rewrites innerHTML on every keystroke, which destroys the
  // browser's native undo stack for a contenteditable. Keep our own instead.
  const history = useRef<HistoryEntry[]>([{ value, caret: value.length }])
  const historyIndex = useRef(0)
  const lastEditAt = useRef(0)
  const breakHistory = useRef(false)

  function resetHistory(text: string): void {
    history.current = [{ value: text, caret: text.length }]
    historyIndex.current = 0
    lastEditAt.current = 0
    breakHistory.current = false
  }

  function pushHistory(text: string, caret: number): void {
    const now = Date.now()
    const entries = history.current
    // Nothing changed (e.g. a paste whose text was moved elsewhere by the
    // parent) — don't leave an undo step that appears to do nothing.
    if (entries[historyIndex.current]?.value === text) return
    // A fresh edit invalidates anything that was redoable.
    entries.length = historyIndex.current + 1

    const coalesce =
      !breakHistory.current && historyIndex.current > 0 && now - lastEditAt.current < COALESCE_MS
    if (coalesce) {
      entries[entries.length - 1] = { value: text, caret }
    } else {
      entries.push({ value: text, caret })
      if (entries.length > MAX_HISTORY) entries.shift()
      historyIndex.current = entries.length - 1
    }
    lastEditAt.current = now
    breakHistory.current = false
  }

  function restoreHistory(entry: HistoryEntry): void {
    const el = editorRef.current
    if (!el) return
    internalValue.current = entry.value
    el.innerHTML = entry.value ? highlight(entry.value) : ''
    setCaretOffset(el, entry.caret)
    caretRef.current = entry.caret
    // Don't merge the next keystroke into the entry we just landed on.
    lastEditAt.current = 0
    setDropdown(null)
    onChange(entry.value)
  }

  function undo(): void {
    if (historyIndex.current <= 0) return
    historyIndex.current--
    restoreHistory(history.current[historyIndex.current])
  }

  function redo(): void {
    if (historyIndex.current >= history.current.length - 1) return
    historyIndex.current++
    restoreHistory(history.current[historyIndex.current])
  }

  useEffect(() => {
    if (!dropdown) return
    const close = (e: Event): void => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setDropdown(null)
    }
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [dropdown])

  // Highlight on mount and when value changes externally (e.g. loading different request, format button)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    // Tracking "has rendered once" rather than testing el.innerHTML: an emptied
    // field has falsy innerHTML, which would misread our own edit as an external
    // one and reset the history — losing the text the user just deleted.
    if (initialised.current && value === internalValue.current) return
    initialised.current = true
    internalValue.current = value
    el.innerHTML = value ? highlight(value) : ''
    // A different request/field is now in this editor — its history isn't ours.
    resetHistory(value)
  }, [value])

  // Re-highlight when variables change (e.g. loaded async) to update tooltips
  const prevVariables = useRef(variables)
  useEffect(() => {
    if (prevVariables.current === variables) return
    prevVariables.current = variables
    const el = editorRef.current
    if (!el || !internalValue.current) return
    const caret = getCaretOffset(el)
    el.innerHTML = highlight(internalValue.current)
    setCaretOffset(el, caret)
  }, [variables])

  function applyHighlight(text: string, caret: number): void {
    const el = editorRef.current
    if (!el) return
    el.innerHTML = text ? highlight(text) : ''
    setCaretOffset(el, caret)
  }

  function handleInput(): void {
    if (skipNextInput.current) {
      skipNextInput.current = false
      return
    }
    if (isComposing.current) return
    const el = editorRef.current
    if (!el) return
    const text = el.textContent ?? ''
    const caret = getCaretOffset(el)
    caretRef.current = caret
    internalValue.current = text
    pushHistory(text, caret)
    onChange(text)

    // Re-highlight and restore caret inline
    applyHighlight(text, caret)

    // Check for variable dropdown trigger
    const match = text.slice(0, caret).match(/\{(\w*)$/)
    if (match) {
      setDropdown({ query: match[1], rect: el.getBoundingClientRect() })
      setHighlightedIndex(0)
    } else {
      setDropdown(null)
    }
  }

  function insertVar(key: string): void {
    const el = editorRef.current
    if (!el) return
    const text = el.textContent ?? ''
    const cursorPos = caretRef.current
    const match = text.slice(0, cursorPos).match(/\{(\w*)$/)
    if (!match) return
    const start = cursorPos - match[0].length
    const end = text.slice(cursorPos).startsWith('}') ? cursorPos + 1 : cursorPos
    const newVal = text.slice(0, start) + `{${key}}` + text.slice(end)
    internalValue.current = newVal
    onChange(newVal)
    setDropdown(null)
    const newCaret = start + key.length + 2
    caretRef.current = newCaret
    breakHistory.current = true
    pushHistory(newVal, newCaret)
    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = highlight(newVal)
        setCaretOffset(editorRef.current, newCaret)
        editorRef.current.focus()
      }
    })
  }

  const dropdownMatches =
    dropdown && variables
      ? variables.filter(
          (v) => !dropdown.query || v.key.toLowerCase().includes(dropdown.query.toLowerCase())
        )
      : []

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    // Native undo is unusable here (see `history`), so drive it ourselves.
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (key === 'y') {
        e.preventDefault()
        redo()
        return
      }
    }
    if (e.key === 'Enter') {
      if (dropdown && dropdownMatches.length > 0) {
        e.preventDefault()
        insertVar(dropdownMatches[highlightedIndex].key)
        return
      }
      if (multiline) {
        e.preventDefault()
        skipNextInput.current = true
        const el = editorRef.current
        if (!el) return
        const text = el.textContent ?? ''
        const caret = getCaretOffset(el)
        const newText = text.slice(0, caret) + '\n' + text.slice(caret)
        const newCaret = caret + 1
        caretRef.current = newCaret
        internalValue.current = newText
        breakHistory.current = true
        pushHistory(newText, newCaret)
        onChange(newText)
        applyHighlight(newText, newCaret)
      } else {
        e.preventDefault()
      }
      return
    }
    if (dropdown && dropdownMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((i) => (i + 1) % dropdownMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((i) => (i - 1 + dropdownMatches.length) % dropdownMatches.length)
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        insertVar(dropdownMatches[highlightedIndex].key)
        return
      }
    }
    if (e.key === 'Escape') {
      setDropdown(null)
    }
    // Allow Tab for indentation in multiline mode (when dropdown is closed)
    if (multiline && e.key === 'Tab' && !dropdown) {
      e.preventDefault()
      document.execCommand('insertText', false, '  ')
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>): void {
    e.preventDefault()
    // A paste is its own undo step, never merged into surrounding typing.
    breakHistory.current = true
    const text = e.clipboardData.getData('text/plain')
    const el = editorRef.current

    if (transformPastedValue && el) {
      const current = el.textContent ?? ''
      const { start, end } = getSelectionOffsets(el)
      const replaced = transformPastedValue(current.slice(0, start) + text + current.slice(end))
      if (replaced !== undefined) {
        const caret = replaced.length
        internalValue.current = replaced
        el.innerHTML = replaced ? highlight(replaced) : ''
        setCaretOffset(el, caret)
        caretRef.current = caret
        pushHistory(replaced, caret)
        onChange(replaced)
        return
      }
    }

    document.execCommand('insertText', false, text)
  }

  // Single-line content scrolls inside its own box. Without the overflow clip,
  // `whitespace-pre` text runs past the element and — since the wrapper below is
  // positioned — paints on top of whatever sits to the right of it.
  return (
    <Tooltip>
    <div className={`relative ${multiline ? 'h-full' : 'min-w-0 flex-1'}`}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          isComposing.current = true
        }}
        onCompositionEnd={() => {
          isComposing.current = false
          handleInput()
        }}
        onBlur={() => {
          setTimeout(() => setDropdown(null), 150)
        }}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={`${className} ${multiline ? 'whitespace-pre-wrap' : 'overflow-x-auto whitespace-pre'} outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-white/30`}
      />

      {dropdownMatches.length > 0 &&
        dropdown &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdown.rect.bottom + 2,
              left: dropdown.rect.left,
              zIndex: 9999
            }}
            className="max-h-32 w-80 overflow-y-auto rounded-lg border border-white/10 bg-op-primary shadow-lg"
          >
            {dropdownMatches.map((v, i) => (
              <button
                key={v.key}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertVar(v.key)
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors ${
                  i === highlightedIndex
                    ? 'bg-white/10 text-white'
                    : 'text-white/70 hover:bg-white/5'
                }`}
              >
                <span className="font-mono text-xs font-bold text-op-tertiary">{`{${v.key}}`}</span>
                <span className="ml-2 truncate text-xs text-white/30">
                  {v.is_secret ? '••••••' : (v.value ?? '')}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
    </Tooltip>
  )
}
