import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { EnvironmentService } from '../../services/EnvironmentService'
import { Button } from '../reusable/Button'
import type { Environment, EnvironmentVariable } from '../../types'

const environmentService = new EnvironmentService(supabase)

export function EnvironmentDetail(): React.JSX.Element {
  const { environmentId } = useParams<{ environmentId: string }>()
  const [environment, setEnvironment] = useState<Environment | null>(null)
  const [variables, setVariables] = useState<EnvironmentVariable[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData(): Promise<void> {
    if (!environmentId) return
    const [envResult, vars] = await Promise.all([
      supabase.from('postpro_environments').select('*').eq('id', environmentId).single(),
      environmentService.getVariables(environmentId)
    ])
    if (envResult.data) setEnvironment(envResult.data)
    setVariables(vars)
    setLoading(false)
  }

  useEffect(() => {
    void (async () => {
      await loadData()
    })()
  }, [environmentId])

  async function handleAddVariable(): Promise<void> {
    if (!environmentId) return
    await environmentService.createVariable({
      environment_id: environmentId,
      key: '',
      value: '',
      is_secret: false
    })
    await loadData()
  }

  async function handleUpdateVariable(
    id: string,
    updates: Partial<Pick<EnvironmentVariable, 'key' | 'value' | 'is_secret' | 'enabled'>>
  ): Promise<void> {
    await environmentService.updateVariable(id, updates)
    await loadData()
  }

  async function handleDeleteVariable(id: string): Promise<void> {
    await environmentService.deleteVariable(id)
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-op-disabled">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-op-primary">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 className="text-sm font-semibold text-white">{environment?.name}</h2>
        <Button size="sm" onClick={handleAddVariable}>
          Add Variable
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {variables.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-op-disabled">
            No variables yet. Click &quot;Add Variable&quot; to create one.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/50">
                <th className="px-6 py-2 font-medium">Key</th>
                <th className="px-6 py-2 font-medium">Value</th>
                <th className="w-20 px-6 py-2 font-medium">Secret</th>
                <th className="w-12 px-6 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <VariableRow
                  key={v.id}
                  variable={v}
                  onUpdate={(updates) => handleUpdateVariable(v.id, updates)}
                  onDelete={() => handleDeleteVariable(v.id)}
                  onToggleSecret={async () => {
                    if (v.is_secret) {
                      await environmentService.makePlain(v.id)
                    } else {
                      await environmentService.makeSecret(v.id, v.value ?? '')
                    }
                    await loadData()
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function VariableRow({
  variable,
  onUpdate,
  onDelete,
  onToggleSecret
}: {
  variable: EnvironmentVariable
  onUpdate: (
    updates: Partial<Pick<EnvironmentVariable, 'key' | 'value' | 'is_secret' | 'enabled'>>
  ) => void
  onDelete: () => void
  onToggleSecret: () => void
}): React.JSX.Element {
  const [key, setKey] = useState(variable.key)
  const [value, setValue] = useState(variable.value ?? '')

  function handleKeyBlur(): void {
    if (key !== variable.key) onUpdate({ key })
  }

  function handleValueBlur(): void {
    if (value !== (variable.value ?? '')) onUpdate({ value })
  }

  return (
    <tr className="group border-b border-white/5">
      <td className="px-6 py-1.5">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={handleKeyBlur}
          placeholder="KEY"
          className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
        />
      </td>
      <td className="px-6 py-1.5">
        {variable.is_secret ? (
          <span className="text-sm text-op-disabled">••••••••</span>
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleValueBlur}
            placeholder="value"
            className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
          />
        )}
      </td>
      <td className="px-6 py-1.5">
        <button
          onClick={onToggleSecret}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            variable.is_secret ? 'bg-op-warning/20 text-op-warning' : 'bg-white/10 text-white/50'
          }`}
        >
          {variable.is_secret ? 'secret' : 'plain'}
        </button>
      </td>
      <td className="px-6 py-1.5">
        <button
          onClick={onDelete}
          className="text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:text-op-error"
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
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </td>
    </tr>
  )
}
