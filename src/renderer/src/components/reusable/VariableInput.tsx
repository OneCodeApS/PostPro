import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Variable {
  key: string
  value: string | null
  is_secret: boolean
}

interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  variables: Variable[]
  placeholder?: string
  className?: string
}

export function VariableInput({
  value,
  onChange,
  variables,
  placeholder,
  className = ''
}: VariableInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdown, setDropdown] = useState<{ query: string; rect: DOMRect } | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  useEffect(() => {
    if (!dropdown) return
    const close = (): void => setDropdown(null)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [dropdown])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    onChange(e.target.value)
    const cursorPos = e.target.selectionStart ?? e.target.value.length
    const match = e.target.value.slice(0, cursorPos).match(/\{([^}]*)$/)
    if (match && inputRef.current) {
      setDropdown({ query: match[1], rect: inputRef.current.getBoundingClientRect() })
      setHighlightedIndex(0)
    } else {
      setDropdown(null)
    }
  }

  function insertVar(key: string): void {
    const input = inputRef.current
    if (!input) return
    const cursorPos = input.selectionStart ?? value.length
    const match = value.slice(0, cursorPos).match(/\{([^}]*)$/)
    if (!match) return
    const start = cursorPos - match[0].length
    const end = value.slice(cursorPos).startsWith('}') ? cursorPos + 1 : cursorPos
    const newVal = value.slice(0, start) + `{${key}}` + value.slice(end)
    onChange(newVal)
    setDropdown(null)
    setTimeout(() => {
      input.setSelectionRange(start + key.length + 2, start + key.length + 2)
      input.focus()
    }, 0)
  }

  const dropdownMatches =
    dropdown && variables
      ? variables.filter(
          (v) => !dropdown.query || v.key.toLowerCase().includes(dropdown.query.toLowerCase())
        )
      : []

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
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
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertVar(dropdownMatches[highlightedIndex].key)
        return
      }
    }
    if (e.key === 'Escape') {
      setDropdown(null)
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setTimeout(() => setDropdown(null), 150)
        }}
        placeholder={placeholder}
        className={className}
      />

      {dropdownMatches.length > 0 &&
        dropdown &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: dropdown.rect.bottom + 2,
              left: dropdown.rect.left,
              minWidth: Math.max(dropdown.rect.width, 192),
              zIndex: 9999
            }}
            className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-op-primary shadow-lg"
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
  )
}
