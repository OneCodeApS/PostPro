import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  separator?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

/** Distance kept between the menu and the window edges. */
const VIEWPORT_MARGIN = 8

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{
    left: number
    top: number
    maxHeight?: number
  } | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Measure the menu once rendered and keep it inside the window: flip it above /
  // left of the cursor when there is not enough room, then clamp as a last resort.
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    const { offsetWidth: width, offsetHeight: height } = menu
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const available = viewportHeight - VIEWPORT_MARGIN * 2

    let left = x
    if (x + width > viewportWidth - VIEWPORT_MARGIN) {
      // Prefer opening to the left of the cursor, otherwise clamp to the edge.
      left = x - width >= VIEWPORT_MARGIN ? x - width : viewportWidth - width - VIEWPORT_MARGIN
    }
    left = Math.max(VIEWPORT_MARGIN, left)

    let top = y
    if (y + height > viewportHeight - VIEWPORT_MARGIN) {
      top = y - height >= VIEWPORT_MARGIN ? y - height : viewportHeight - height - VIEWPORT_MARGIN
    }
    top = Math.max(VIEWPORT_MARGIN, top)

    setPosition({
      left,
      top,
      // Taller than the window: pin to the top and let the menu scroll.
      maxHeight: height > available ? available : undefined
    })
  }, [x, y, items.length])

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-44 overflow-y-auto rounded-lg bg-op-primary py-1 shadow-lg border border-white/10"
      style={{
        left: position?.left ?? x,
        top: position?.top ?? y,
        maxHeight: position?.maxHeight,
        // Hide the first paint at the raw cursor position until measured.
        visibility: position ? 'visible' : 'hidden'
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          {item.separator && <div className="my-1 border-t border-white/10" />}
          <button
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className="w-full px-3 py-1.5 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}
