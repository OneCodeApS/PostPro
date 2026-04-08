import { useState, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { ResponseSearch } from './ResponseSearch'

interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
}

type ResponseTab = 'body' | 'headers'

interface ResponsePanelProps {
  response: ResponseState | null
  responseError: string | null
  sending?: boolean
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightJson(text: string): string {
  const token =
    /("(?:[^"\\]|\\.)*")\s*(?=:)|("(?:[^"\\]|\\.)*")|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b(true|false|null)\b|([{}[\]:,])|(\n)|(.)/g

  let result = ''
  let m: RegExpExecArray | null
  while ((m = token.exec(text)) !== null) {
    if (m[1]) {
      result += `<span class="text-blue-400">${escapeHtml(m[1])}</span>`
    } else if (m[2]) {
      result += `<span class="text-green-400">${escapeHtml(m[2])}</span>`
    } else if (m[3]) {
      result += `<span class="text-orange-400">${escapeHtml(m[3])}</span>`
    } else if (m[4]) {
      result += `<span class="text-purple-400">${escapeHtml(m[4])}</span>`
    } else if (m[5]) {
      result += `<span class="text-white/40">${escapeHtml(m[5])}</span>`
    } else if (m[6]) {
      result += '\n'
    } else {
      result += escapeHtml(m[0])
    }
  }
  return result
}

function formatAndHighlight(body: string, search?: string, activeIndex?: number): string {
  let formatted: string
  try {
    formatted = JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    formatted = body
  }

  if (!search) {
    return highlightJson(formatted)
  }

  // First apply JSON syntax highlighting
  const highlighted = highlightJson(formatted)

  // Then apply search highlighting on the visible text by working on the HTML
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  let matchIndex = 0
  return highlighted.replace(/>([^<]*)</g, (_fullMatch, textContent: string) => {
    const replaced = textContent.replace(regex, (_m, group: string) => {
      const cls =
        matchIndex === activeIndex
          ? 'bg-op-tertiary/60 text-white rounded px-0.5'
          : 'bg-yellow-500/30 text-white rounded px-0.5'
      const result = `</span><mark class="${cls}">${escapeHtml(group)}</mark><span>`
      matchIndex++
      return result
    })
    return `>${replaced}<`
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ResponsePanel({
  response,
  responseError,
  sending = false
}: ResponsePanelProps): React.JSX.Element {
  const [height, setHeight] = useState(500)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<ResponseTab>('body')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchActiveIndex, setSearchActiveIndex] = useState(0)
  const bodyRef = useRef<HTMLPreElement>(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    dragging.current = true
    startY.current = e.clientY
    startH.current = height
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    if (!dragging.current) return
    const delta = startY.current - e.clientY
    setHeight(Math.max(40, Math.min(600, startH.current + delta)))
  }

  function onPointerUp(): void {
    dragging.current = false
  }

  const bodySize = response ? new Blob([response.body]).size : 0

  return (
    <div className="flex flex-col border-t border-white/10" style={{ height, minHeight: 40 }}>
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex shrink-0 cursor-row-resize items-center justify-center py-0.5 hover:bg-white/5"
      >
        <div className="h-0.5 w-8 rounded-full bg-white/20" />
      </div>

      <div className="flex items-center gap-3 px-4 py-1.5">
        <span className="text-xs font-medium text-white/50">Response</span>
        {response && (
          <>
            <span
              className={`text-xs font-bold ${
                response.status < 300
                  ? 'text-op-success'
                  : response.status < 400
                    ? 'text-op-warning'
                    : 'text-op-error'
              }`}
            >
              {response.status} {response.statusText}
            </span>
            <span className="text-xs text-white/40">{response.time}ms</span>
            <span className="text-xs text-white/40">{formatSize(bodySize)}</span>
            <button
              onClick={() => {
                const formatted = (() => {
                  try {
                    return JSON.stringify(JSON.parse(response.body), null, 2)
                  } catch {
                    return response.body
                  }
                })()
                navigator.clipboard.writeText(formatted)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
              className="ml-auto text-xs text-white/30 transition-colors hover:text-white/60"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </>
        )}
        {responseError && <span className="text-xs text-op-error">{responseError}</span>}
      </div>

      {/* Response tabs */}
      {response && (
        <div className="flex border-b border-white/5 px-4">
          {(['body', 'headers'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b border-white/50 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {tab === 'body' ? 'Body' : `Headers (${Object.keys(response.headers).length})`}
            </button>
          ))}
        </div>
      )}

      {response && activeTab === 'body' && (
        <ResponseSearch
          body={response.body}
          bodyRef={bodyRef}
          onHighlight={(search, activeIndex) => {
            setSearchQuery(search)
            setSearchActiveIndex(activeIndex)
          }}
        />
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {sending ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-white/40">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Sending request...
          </div>
        ) : response ? (
          activeTab === 'body' ? (
            <pre
              ref={bodyRef}
              className="whitespace-pre-wrap rounded bg-white/5 p-3 font-mono text-xs text-white/80 [overflow-wrap:break-word]"
              dangerouslySetInnerHTML={{
                __html: formatAndHighlight(response.body, searchQuery, searchActiveIndex)
              }}
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/50">
                  <th className="w-1/3 px-3 py-2 font-medium">Header</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(response.headers).map(([key, val]) => (
                  <tr key={key} className="border-b border-white/5">
                    <td className="px-3 py-1.5 text-xs font-medium text-blue-400">{key}</td>
                    <td className="break-all px-3 py-1.5 text-xs text-white/70">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : !responseError ? (
          <div className="flex h-full items-center justify-center text-xs text-white/20">
            Send a request to see the response
          </div>
        ) : null}
      </div>
    </div>
  )
}
