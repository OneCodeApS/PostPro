import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEnvironments } from '../../contexts/EnvironmentsContext'
import { Button } from '../reusable/Button'
import { ContextMenu, type ContextMenuItem } from '../reusable/ContextMenu'
import { Modal } from '../reusable/Modal'

interface ContextMenuState {
  x: number
  y: number
  targetId: string
}

interface RenameState {
  id: string
  value: string
}

export function EnvironmentsPanel(): React.JSX.Element {
  const { environments, loading, createEnvironment, renameEnvironment, deleteEnvironment } =
    useEnvironments()
  const navigate = useNavigate()
  const { environmentId } = useParams()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renaming, setRenaming] = useState<RenameState | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleCreate(): Promise<void> {
    const env = await createEnvironment('New Environment')
    navigate(`/environments/${env.id}`)
    setRenaming({ id: env.id, value: env.name })
  }

  function handleStartRename(id: string): void {
    const env = environments.find((e) => e.id === id)
    if (env) setRenaming({ id, value: env.name })
  }

  async function handleFinishRename(): Promise<void> {
    if (!renaming) return
    const { id, value } = renaming
    const name = value.trim()
    const current = environments.find((e) => e.id === id)
    setRenaming(null)
    if (!name || !current || name === current.name) return
    await renameEnvironment(id, name)
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!deletingId) return
    const id = deletingId
    setDeletingId(null)
    await deleteEnvironment(id)
    if (environmentId === id) navigate('/environments')
  }

  function getContextMenuItems(): ContextMenuItem[] {
    if (!contextMenu) return []
    const id = contextMenu.targetId
    return [
      { label: 'Rename', onClick: () => handleStartRename(id) },
      { label: 'Delete', separator: true, onClick: () => setDeletingId(id) }
    ]
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        Loading...
      </div>
    )
  }

  const deletingEnvironment = environments.find((e) => e.id === deletingId)

  return (
    <div className="flex h-full flex-col bg-op-primary">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Environments</h2>
        <button
          onClick={() => void handleCreate()}
          title="New Environment"
          className="flex h-6 w-6 items-center justify-center rounded text-white/40 transition-colors hover:bg-white/10 hover:text-white"
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
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {environments.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-white/40">No environments yet</div>
        ) : (
          environments.map((env) => (
            <button
              key={env.id}
              onClick={() => navigate(`/environments/${env.id}`)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, targetId: env.id })
              }}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors ${
                environmentId === env.id
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
              {renaming?.id === env.id ? (
                <input
                  autoFocus
                  value={renaming.value}
                  onChange={(e) => setRenaming({ id: env.id, value: e.target.value })}
                  onBlur={() => void handleFinishRename()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') void handleFinishRename()
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 rounded bg-white/10 px-1 py-0.5 text-sm text-white outline-none focus:bg-white/20"
                />
              ) : (
                <span className="truncate">{env.name}</span>
              )}
            </button>
          ))
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
      {deletingEnvironment && (
        <Modal title="Delete Environment" onClose={() => setDeletingId(null)}>
          <p className="text-sm text-white/70">
            Delete <span className="font-semibold text-white">{deletingEnvironment.name}</span> and
            all of its variables, including secrets? This cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={() => void handleConfirmDelete()}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
