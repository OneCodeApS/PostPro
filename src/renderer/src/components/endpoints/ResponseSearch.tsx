import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface ResponseSearchProps {
  body: string
  bodyRef: React.RefObject<HTMLPreElement | null>
  onHighlight: (search: string, activeIndex: number) => void
}

export function ResponseSearch({ body, bodyRef, onHighlight }: ResponseSearchProps): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [currentMatch, setCurrentMatch] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Skip expensive formatting/searching for very large bodies
  const isLarge = body.length > 500_000

  const formattedBody = useMemo(() => {
    if (isLarge) return body // skip JSON re-parse for large bodies
    try {
      return JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return body
    }
  }, [body, isLarge])

  const matchCount = useMemo(() => {
    if (!query || !formattedBody) return 0
    if (isLarge) return 0 // disable search matching for very large bodies
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = formattedBody.match(new RegExp(escaped, 'gi'))
    return matches?.length ?? 0
  }, [query, formattedBody, isLarge])

  useEffect(() => {
    setCurrentMatch(0)
  }, [query])

  useEffect(() => {
    onHighlight(query, currentMatch)
  }, [query, currentMatch])

  const navigateMatch = useCallback(
    (direction: 'next' | 'prev') => {
      if (matchCount === 0) return
      setCurrentMatch((prev) => {
        const next = direction === 'next' ? prev + 1 : prev - 1
        if (next >= matchCount) return 0
        if (next < 0) return matchCount - 1
        return next
      })
    },
    [matchCount]
  )

  // Scroll to current match
  useEffect(() => {
    if (!bodyRef.current || matchCount === 0) return
    const marks = bodyRef.current.querySelectorAll('mark')
    const active = marks[currentMatch]
    if (active) {
      active.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [currentMatch, matchCount, query])

  function close(): void {
    setOpen(false)
    setQuery('')
    onHighlight('', 0)
  }

  // Ctrl+F shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && open) {
        close()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null

  return (
    <div className="flex items-center gap-2 border-b border-white/5 px-4 py-1.5">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            navigateMatch(e.shiftKey ? 'prev' : 'next')
          }
          if (e.key === 'Escape') close()
        }}
        placeholder="Search response..."
        className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30 focus:bg-white/15"
      />
      {query && (
        <span className="text-xs text-white/40">
          {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : 'No matches'}
        </span>
      )}
      <button
        onClick={() => navigateMatch('prev')}
        className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
      </button>
      <button
        onClick={() => navigateMatch('next')}
        className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <button
        onClick={close}
        className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </button>
    </div>
  )
}
