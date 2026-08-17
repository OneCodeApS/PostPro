import { useEffect, useRef, useState } from 'react'

interface ResizablePanelProps {
  /** localStorage key the width / collapsed state is persisted under. */
  storageKey: string
  /** Used in the divider tooltips and aria labels, e.g. "endpoints". */
  label: string
  children: React.ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  /** Dragging narrower than this collapses the panel instead of shrinking it. */
  collapseThreshold?: number
}

interface PanelState {
  /** Width to use when expanded — kept while collapsed so it can be restored. */
  width: number
  collapsed: boolean
}

function loadState(key: string, defaultWidth: number): PanelState {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelState>
      if (typeof parsed.width === 'number' && Number.isFinite(parsed.width)) {
        return { width: parsed.width, collapsed: parsed.collapsed === true }
      }
    }
  } catch {
    // Unavailable or corrupt storage — fall through to the default.
  }
  return { width: defaultWidth, collapsed: false }
}

/**
 * Side panel with a draggable divider on its right edge. Dragging past
 * `collapseThreshold` collapses the panel; the divider then offers a button to
 * bring it back at its previous width. Double-clicking the divider toggles.
 */
export function ResizablePanel({
  storageKey,
  label,
  children,
  defaultWidth = 256,
  minWidth = 180,
  maxWidth = 560,
  collapseThreshold = 130
}: ResizablePanelProps): React.JSX.Element {
  const [state, setState] = useState<PanelState>(() => loadState(storageKey, defaultWidth))
  const [dragging, setDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    startX: number
    startWidth: number
    /** Width to commit if the drag ends expanded. */
    width: number
    /** Width to keep for later restore if the drag ends collapsed. */
    restoreWidth: number
    collapsed: boolean
    moved: boolean
  } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Persisting the size is best-effort only.
    }
  }, [storageKey, state])

  // Keep the resize cursor and kill text selection for the whole drag, not just
  // while the pointer happens to be over the divider.
  useEffect(() => {
    if (!dragging) return
    const { userSelect, cursor } = document.body.style
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    return () => {
      document.body.style.userSelect = userSelect
      document.body.style.cursor = cursor
    }
  }, [dragging])

  function clamp(width: number): number {
    return Math.min(Math.max(width, minWidth), maxWidth)
  }

  /** Applied straight to the DOM during a drag so the content never re-renders. */
  function previewWidth(width: number): void {
    if (panelRef.current) panelRef.current.style.width = `${width}px`
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startWidth: state.collapsed ? 0 : state.width,
      width: state.width || defaultWidth,
      restoreWidth: state.width || defaultWidth,
      collapsed: state.collapsed,
      moved: false
    }
    setDragging(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag) return
    const delta = e.clientX - drag.startX
    if (Math.abs(delta) > 2) drag.moved = true

    const raw = drag.startWidth + delta
    if (raw < collapseThreshold) {
      drag.collapsed = true
      previewWidth(0)
    } else {
      drag.collapsed = false
      drag.width = clamp(raw)
      previewWidth(drag.width)
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (!drag.moved) {
      // A plain click on the divider only expands — collapsing on a stray click
      // would be too easy to trigger by accident.
      if (state.collapsed) setState((prev) => ({ ...prev, collapsed: false }))
      return
    }
    // Collapsing keeps the width the panel had before the drag, so expanding
    // again lands back where the user left it rather than on some width the
    // pointer happened to pass through on its way in.
    setState(
      drag.collapsed
        ? { width: drag.restoreWidth, collapsed: true }
        : { width: drag.width, collapsed: false }
    )
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const step = e.shiftKey ? 48 : 16
    const current = state.collapsed ? 0 : state.width
    const next = current + (e.key === 'ArrowRight' ? step : -step)
    if (next < collapseThreshold) {
      setState((prev) => ({ ...prev, collapsed: true }))
    } else {
      setState({ width: clamp(next), collapsed: false })
    }
  }

  function toggleCollapsed(): void {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }))
  }

  return (
    <div className="relative flex h-full shrink-0">
      <div
        ref={panelRef}
        className="h-full shrink-0 overflow-hidden"
        style={{
          width: state.collapsed ? 0 : state.width,
          transition: dragging ? undefined : 'width 150ms ease'
        }}
      >
        {children}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} panel`}
        aria-valuenow={state.collapsed ? 0 : state.width}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={toggleCollapsed}
        onKeyDown={handleKeyDown}
        title={`Drag to resize, double-click to ${state.collapsed ? 'show' : 'hide'} ${label}`}
        className={`relative w-px shrink-0 cursor-col-resize outline-none transition-colors hover:bg-op-tertiary focus-visible:bg-op-tertiary ${
          dragging ? 'bg-op-tertiary' : 'bg-white/10'
        }`}
      >
        {/* Widens the grab area without thickening the 1px divider itself. */}
        <div className="absolute inset-y-0 -left-1 -right-1" />
        {state.collapsed && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setState((prev) => ({ ...prev, collapsed: false }))}
            title={`Show ${label}`}
            className="absolute left-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-white/10 bg-op-primary text-white/40 transition-colors hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
