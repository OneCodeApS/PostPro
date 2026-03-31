import { useState, useRef, useEffect } from 'react'
import type { BoardWithWorkspace } from '../../types'
import { BoardService } from '../../services/BoardService'
import { supabase } from '../../lib/supabase'

const boardService = new BoardService(supabase)

interface BoardSearchProps {
  requestId: string
}

export function BoardSearch({ requestId }: BoardSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BoardWithWorkspace[]>([])
  const [linked, setLinked] = useState<BoardWithWorkspace[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void (async () => {
      const boards = await boardService.getLinkedBoards(requestId)
      setLinked(boards)
    })()
  }, [requestId])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  function handleSearch(value: string): void {
    setQuery(value)
    setHighlightedIndex(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      void (async () => {
        try {
          const boards = await boardService.search(value)
          const linkedIds = new Set(linked.map((b) => b.id))
          setResults(boards.filter((b) => !linkedIds.has(b.id)))
        } finally {
          setLoading(false)
        }
      })()
    }, 300)
  }

  async function handleLink(board: BoardWithWorkspace): Promise<void> {
    await boardService.linkBoard(requestId, board.id)
    setLinked((prev) => [...prev, board])
    setQuery('')
    setResults([])
  }

  async function handleUnlink(boardId: string): Promise<void> {
    await boardService.unlinkBoard(requestId, boardId)
    setLinked((prev) => prev.filter((b) => b.id !== boardId))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((i) => (i + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((i) => (i - 1 + results.length) % results.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        void handleLink(results[highlightedIndex])
      }
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const hasLinked = linked.length > 0

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={hasLinked ? `${linked.length} board(s) linked` : 'Link a board'}
        className={`flex h-9 w-9 items-center justify-center rounded transition-colors hover:bg-white/10 ${
          hasLinked ? 'text-op-success' : 'text-white/40'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-white/10 bg-op-primary shadow-lg">
          {/* Search */}
          <div className="relative border-b border-white/10 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search boards..."
              className="w-full rounded bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none placeholder-white/30 focus:bg-white/10"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <svg
                  className="h-3 w-3 animate-spin text-white/30"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>

          {/* Search results */}
          {results.length > 0 && (
            <div className="max-h-36 overflow-y-auto border-b border-white/10">
              {results.map((board, i) => (
                <button
                  key={board.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    void handleLink(board)
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs transition-colors ${
                    i === highlightedIndex
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="text-white/40">{board.workspace_name}</span>
                  <span className="text-white/20">/</span>
                  <span>{board.name}</span>
                </button>
              ))}
            </div>
          )}

          {query && !loading && results.length === 0 && (
            <div className="border-b border-white/10 px-3 py-2 text-xs text-white/30">
              No boards found
            </div>
          )}

          {/* Linked boards */}
          <div className="max-h-36 overflow-y-auto p-2">
            {linked.length === 0 ? (
              <div className="px-1 py-1 text-xs text-white/30">No boards linked</div>
            ) : (
              <div className="flex flex-col gap-1">
                {linked.map((board) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between rounded bg-white/5 px-2 py-1"
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-white/40">{board.workspace_name}</span>
                      <span className="text-white/20">/</span>
                      <span className="text-white">{board.name}</span>
                    </div>
                    <button
                      onClick={() => void handleUnlink(board.id)}
                      className="text-white/30 transition-colors hover:text-op-error"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
