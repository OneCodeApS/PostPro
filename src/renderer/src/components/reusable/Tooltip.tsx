import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipState {
  text: string
  x: number
  y: number
}

/**
 * Attaches custom tooltips to any child elements with a `data-tooltip` attribute.
 * Wrap a container element and any descendant with `data-tooltip="some text"` will
 * show a styled tooltip on hover.
 */
export function Tooltip({ children }: { children: React.ReactNode }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleOver(e: MouseEvent): void {
      const target = (e.target as HTMLElement).closest?.('[data-tooltip]') as HTMLElement | null
      if (!target) return
      const text = target.getAttribute('data-tooltip')
      if (!text) return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      const rect = target.getBoundingClientRect()
      setTooltip({ text, x: rect.left + rect.width / 2, y: rect.top })
    }

    function handleOut(e: MouseEvent): void {
      const target = (e.target as HTMLElement).closest?.('[data-tooltip]')
      if (!target) return
      timeoutRef.current = setTimeout(() => setTooltip(null), 100)
    }

    el.addEventListener('mouseover', handleOver)
    el.addEventListener('mouseout', handleOut)
    return () => {
      el.removeEventListener('mouseover', handleOver)
      el.removeEventListener('mouseout', handleOut)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} className="contents">
      {children}
      {tooltip &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: tooltip.y - 4,
              left: tooltip.x,
              transform: 'translate(-50%, -100%)',
              zIndex: 9999
            }}
            className="rounded-md border border-white/10 bg-op-secondary px-2.5 py-1 text-xs text-white/80 shadow-lg"
          >
            {tooltip.text}
          </div>,
          document.body
        )}
    </div>
  )
}
