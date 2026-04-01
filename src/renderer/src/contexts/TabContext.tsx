import { createContext, useContext, useState, useCallback } from 'react'

export interface Tab {
  id: string
  name: string
  method: string
}

interface TabContextValue {
  tabs: Tab[]
  activeTabId: string | null
  dirtyTabs: Set<string>
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setTabDirty: (id: string, dirty: boolean) => void
  updateTab: (id: string, updates: Partial<Pick<Tab, 'name' | 'method'>>) => void
}

const TabContext = createContext<TabContextValue | null>(null)

export function TabProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set())

  const openTab = useCallback((tab: Tab) => {
    setTabs((prev) => {
      if (prev.some((t) => t.id === tab.id)) return prev
      return [...prev, tab]
    })
    setActiveTabId(tab.id)
  }, [])

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id)
        return next
      })
      setDirtyTabs((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setActiveTabId((prev) => {
        if (prev !== id) return prev
        // Activate adjacent tab
        const idx = tabs.findIndex((t) => t.id === id)
        const next = tabs[idx + 1] ?? tabs[idx - 1]
        return next?.id ?? null
      })
    },
    [tabs]
  )

  const setTabDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyTabs((prev) => {
      const next = new Set(prev)
      if (dirty) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const updateTab = useCallback((id: string, updates: Partial<Pick<Tab, 'name' | 'method'>>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
  }, [])

  return (
    <TabContext.Provider
      value={{
        tabs,
        activeTabId,
        dirtyTabs,
        openTab,
        closeTab,
        setActiveTab: setActiveTabId,
        setTabDirty,
        updateTab
      }}
    >
      {children}
    </TabContext.Provider>
  )
}

export function useTabs(): TabContextValue {
  const ctx = useContext(TabContext)
  if (!ctx) throw new Error('useTabs must be used within TabProvider')
  return ctx
}
