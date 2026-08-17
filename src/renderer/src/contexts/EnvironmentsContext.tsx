import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EnvironmentService } from '../services/EnvironmentService'
import { useAuth } from './AuthContext'
import type { Environment } from '../types'

const environmentService = new EnvironmentService(supabase)

interface EnvironmentsContextType {
  environments: Environment[]
  loading: boolean
  createEnvironment: (name: string) => Promise<Environment>
  renameEnvironment: (id: string, name: string) => Promise<void>
  deleteEnvironment: (id: string) => Promise<void>
}

const EnvironmentsContext = createContext<EnvironmentsContextType | undefined>(undefined)

export function EnvironmentsProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { companyId } = useAuth()
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async (): Promise<void> => {
    if (!companyId) return
    setEnvironments(await environmentService.getAll(companyId))
    setLoading(false)
  }, [companyId])

  // The panel is only rendered once a company is known, so skipping the fetch
  // while companyId is null just leaves the provider in its initial state.
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    environmentService
      .getAll(companyId)
      .then((envs) => {
        if (cancelled) return
        setEnvironments(envs)
        setLoading(false)
      })
      .catch((err) => console.error('Failed to load environments:', err))
    return () => {
      cancelled = true
    }
  }, [companyId])

  async function createEnvironment(name: string): Promise<Environment> {
    if (!companyId) throw new Error('No company selected')
    const env = await environmentService.create({ company_id: companyId, name })
    await reload()
    return env
  }

  async function renameEnvironment(id: string, name: string): Promise<void> {
    await environmentService.update(id, { name })
    await reload()
  }

  async function deleteEnvironment(id: string): Promise<void> {
    await environmentService.delete(id)
    await reload()
  }

  return (
    <EnvironmentsContext.Provider
      value={{ environments, loading, createEnvironment, renameEnvironment, deleteEnvironment }}
    >
      {children}
    </EnvironmentsContext.Provider>
  )
}

export function useEnvironments(): EnvironmentsContextType {
  const context = useContext(EnvironmentsContext)
  if (context === undefined) {
    throw new Error('useEnvironments must be used within an EnvironmentsProvider')
  }
  return context
}
