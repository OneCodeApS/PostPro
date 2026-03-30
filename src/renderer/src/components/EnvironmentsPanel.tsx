import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EnvironmentService } from '../services/EnvironmentService'
import type { Environment } from '../types'

interface EnvironmentsPanelProps {
  companyId: string
  onSelectEnvironment: (env: Environment) => void
  selectedEnvironmentId: string | null
}

export function EnvironmentsPanel({
  companyId,
  onSelectEnvironment,
  selectedEnvironmentId
}: EnvironmentsPanelProps): React.JSX.Element {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const envService = new EnvironmentService(supabase)

    async function load(): Promise<void> {
      const envs = await envService.getAll(companyId)
      setEnvironments(envs)
      setLoading(false)
    }

    load()
  }, [companyId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Environments</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {environments.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-white/40">No environments yet</div>
        ) : (
          environments.map((env) => (
            <button
              key={env.id}
              onClick={() => onSelectEnvironment(env)}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
                selectedEnvironmentId === env.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10'
              }`}
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
                className="shrink-0 text-white/50"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="truncate">{env.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
