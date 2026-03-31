import { useEffect, useRef } from 'react'

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

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-44 rounded-lg bg-op-primary py-1 shadow-lg border border-white/10"
      style={{ left: x, top: y }}
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
