import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTabs } from '../../contexts/TabContext'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-gray-400'
}

interface ContextMenuState {
  x: number
  y: number
  tabId: string
}

export function TabBar(): React.JSX.Element | null {
  const { tabs, activeTabId, dirtyTabs, setActiveTab, closeTab } = useTabs()
  const navigate = useNavigate()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    function handleClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextMenu])

  function handleSelectTab(id: string): void {
    setActiveTab(id)
    navigate(`/endpoints/${id}`)
  }

  function handleCloseTab(id: string): void {
    const idx = tabs.findIndex((t) => t.id === id)
    const next = tabs[idx + 1] ?? tabs[idx - 1]
    closeTab(id)
    if (next && activeTabId === id) {
      navigate(`/endpoints/${next.id}`)
    } else if (!next) {
      navigate('/endpoints')
    }
  }

  function handleCloseAllSaved(): void {
    const savedTabs = tabs.filter((t) => !dirtyTabs.has(t.id))
    for (const t of savedTabs) {
      closeTab(t.id)
    }
    // If active tab was closed, navigate to a remaining tab or home
    const remaining = tabs.filter((t) => dirtyTabs.has(t.id))
    if (remaining.length > 0 && savedTabs.some((t) => t.id === activeTabId)) {
      setActiveTab(remaining[0].id)
      navigate(`/endpoints/${remaining[0].id}`)
    } else if (remaining.length === 0) {
      navigate('/endpoints')
    }
  }

  function handleSaveTab(tabId: string): void {
    // Dispatch custom event that RequestDetail listens to
    window.dispatchEvent(new CustomEvent('postpro-save-request', { detail: { requestId: tabId } }))
    setContextMenu(null)
  }

  if (tabs.length === 0) return null

  return (
    <>
      <div className="flex shrink-0 overflow-x-auto border-b border-white/10 bg-op-primary">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          const isDirty = dirtyTabs.has(tab.id)

          return (
            <div
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  handleCloseTab(tab.id)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
              }}
              className={`group flex cursor-pointer items-center gap-2 border-r border-white/5 px-3 py-1.5 text-xs transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/70'
              }`}
            >
              <span className={`font-bold ${METHOD_COLORS[tab.method] ?? 'text-white/40'}`}>
                {tab.method}
              </span>
              <span className="max-w-32 truncate">{tab.name}</span>
              {isDirty && <div className="h-1.5 w-1.5 rounded-full bg-op-warning" />}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseTab(tab.id)
                }}
                className="ml-0.5 text-white/20 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white/60"
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
          )
        })}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="min-w-40 rounded-lg border border-white/10 bg-op-primary py-1 shadow-lg"
        >
          <button
            onClick={() => handleSaveTab(contextMenu.tabId)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Save
            <span className="ml-auto text-white/30">Ctrl+S</span>
          </button>
          <button
            onClick={() => {
              handleCloseTab(contextMenu.tabId)
              setContextMenu(null)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
          <div className="my-1 border-t border-white/5" />
          <button
            onClick={() => {
              handleCloseAllSaved()
              setContextMenu(null)
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Close All Saved
          </button>
        </div>
      )}
    </>
  )
}
