import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { CollectionService } from '../../services/CollectionService'
import { RequestService } from '../../services/RequestService'
import { EnvironmentService } from '../../services/EnvironmentService'
import { ContextMenu, type ContextMenuItem } from '../reusable/ContextMenu'
import { Modal } from '../reusable/Modal'
import { SearchInput } from '../reusable/SearchInput'
import { useTabs } from '../../contexts/TabContext'
import type { Collection, Request, Environment } from '../../types'

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-gray-400'
}

const collectionService = new CollectionService(supabase)
const requestService = new RequestService(supabase)
const environmentService = new EnvironmentService(supabase)

interface ContextMenuState {
  x: number
  y: number
  type: 'collection' | 'request'
  targetId: string
  collectionId?: string
}

interface RenameState {
  id: string
  type: 'collection' | 'request'
  value: string
}

interface EndpointsPanelProps {
  companyId: string
}

export function EndpointsPanel({ companyId }: EndpointsPanelProps): React.JSX.Element {
  const navigate = useNavigate()
  const { requestId: selectedRequestId } = useParams()
  const { openTab, activeTabId } = useTabs()

  function selectRequest(req: Request): void {
    openTab({ id: req.id, name: req.name, method: req.method || 'GET' })
    navigate(`/endpoints/${req.id}`)
  }
  const [collections, setCollections] = useState<Collection[]>([])
  const [requests, setRequests] = useState<Request[]>([])
  const [environments, setEnvironments] = useState<Map<string, Environment>>(new Map())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [renaming, setRenaming] = useState<RenameState | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [envPickerCollectionId, setEnvPickerCollectionId] = useState<string | null>(null)

  const { matchingRequestIds, visibleCollectionIds } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return { matchingRequestIds: null, visibleCollectionIds: null }

    const matchReqIds = new Set<string>()
    const visColIds = new Set<string>()

    function markAncestors(collectionId: string | null): void {
      let colId = collectionId
      while (colId) {
        if (visColIds.has(colId)) break
        visColIds.add(colId)
        const col = collections.find((c) => c.id === colId)
        colId = col?.parent_collection_id ?? null
      }
    }

    for (const req of requests) {
      if (
        req.name.toLowerCase().includes(query) ||
        req.method.toLowerCase().includes(query) ||
        (req.url && req.url.toLowerCase().includes(query))
      ) {
        matchReqIds.add(req.id)
        markAncestors(req.collection_id)
      }
    }

    // Only search root-level collections; when matched, include entire subtree
    function markDescendants(colId: string): void {
      visColIds.add(colId)
      for (const req of requests) {
        if (req.collection_id === colId) matchReqIds.add(req.id)
      }
      for (const child of collections) {
        if (child.parent_collection_id === colId) markDescendants(child.id)
      }
    }

    for (const col of collections) {
      if (!col.parent_collection_id && col.name.toLowerCase().includes(query)) {
        markDescendants(col.id)
      }
    }

    return { matchingRequestIds: matchReqIds, visibleCollectionIds: visColIds }
  }, [searchQuery, collections, requests])

  async function load(): Promise<void> {
    const [cols, envs] = await Promise.all([
      collectionService.getAll(companyId),
      environmentService.getAll(companyId)
    ])
    setCollections(cols)
    setEnvironments(new Map(envs.map((e) => [e.id, e])))

    const colIds = cols.map((c) => c.id)
    const reqs = await requestService.getByCollections(colIds)
    setRequests(reqs)
    setLoading(false)
  }

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [companyId])

  function toggleExpand(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getChildCollections(parentId: string | null): Collection[] {
    return collections.filter((c) => c.parent_collection_id === parentId)
  }

  function getCollectionRequests(collectionId: string): Request[] {
    return requests.filter((r) => r.collection_id === collectionId)
  }

  function handleCollectionContextMenu(e: React.MouseEvent, collectionId: string): void {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'collection',
      targetId: collectionId,
      collectionId
    })
  }

  function handleRequestContextMenu(e: React.MouseEvent, requestId: string): void {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'request', targetId: requestId })
  }

  async function handleCreateFolder(parentId: string | null): Promise<void> {
    const newCol = await collectionService.create({
      company_id: companyId,
      name: 'New Folder',
      parent_collection_id: parentId
    })
    if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId))
    await load()
    handleStartRename('collection', newCol.id)
  }

  function handleStartRename(type: 'collection' | 'request', id: string): void {
    if (type === 'collection') {
      const col = collections.find((c) => c.id === id)
      if (col) setRenaming({ id, type, value: col.name })
    } else {
      const req = requests.find((r) => r.id === id)
      if (req) setRenaming({ id, type, value: req.name })
    }
  }

  async function handleFinishRename(): Promise<void> {
    if (!renaming || !renaming.value.trim()) {
      setRenaming(null)
      return
    }
    if (renaming.type === 'collection') {
      await collectionService.update(renaming.id, { name: renaming.value.trim() })
    } else {
      await requestService.update(renaming.id, { name: renaming.value.trim() })
    }
    setRenaming(null)
    await load()
  }

  async function handleDeleteCollection(collectionId: string): Promise<void> {
    await collectionService.delete(collectionId)
    await load()
  }

  async function handleDeleteRequest(requestId: string): Promise<void> {
    await requestService.delete(requestId)
    await load()
  }

  async function handleSetEnvironment(
    collectionId: string,
    environmentId: string | null
  ): Promise<void> {
    await collectionService.update(collectionId, { environment_id: environmentId })
    setEnvPickerCollectionId(null)
    await load()
  }

  async function handleCreateRequest(collectionId: string): Promise<void> {
    const newReq = await requestService.create({
      collection_id: collectionId,
      name: 'New Request'
    })
    setExpandedIds((prev) => new Set(prev).add(collectionId))
    await load()
    selectRequest(newReq)
  }

  function getContextMenuItems(): ContextMenuItem[] {
    if (!contextMenu) return []
    if (contextMenu.type === 'collection') {
      const colId = contextMenu.targetId
      return [
        { label: 'New Folder', onClick: () => handleCreateFolder(colId) },
        { label: 'New Request', onClick: () => handleCreateRequest(colId) },
        { label: 'Set Environment', onClick: () => setEnvPickerCollectionId(colId) },
        { label: 'Rename', onClick: () => handleStartRename('collection', colId) },
        { label: 'Delete', separator: true, onClick: () => handleDeleteCollection(colId) }
      ]
    } else {
      const reqId = contextMenu.targetId
      return [
        { label: 'Rename', onClick: () => handleStartRename('request', reqId) },
        { label: 'Delete', separator: true, onClick: () => handleDeleteRequest(reqId) }
      ]
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/40">
        Loading...
      </div>
    )
  }

  const allRootCollections = getChildCollections(null)
  const rootCollections = visibleCollectionIds
    ? allRootCollections.filter((c) => visibleCollectionIds.has(c.id))
    : allRootCollections

  return (
    <div className="flex h-full flex-col bg-op-primary">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Endpoints</h2>
          <button
            onClick={() => void handleCreateFolder(null)}
            title="New Folder"
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
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search endpoints..."
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {rootCollections.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-white/40">No collections yet</div>
        ) : (
          rootCollections.map((col) => (
            <CollectionNode
              key={col.id}
              collection={col}
              depth={0}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
              onCollectionContextMenu={handleCollectionContextMenu}
              onRequestContextMenu={handleRequestContextMenu}
              getChildCollections={getChildCollections}
              getCollectionRequests={getCollectionRequests}
              onSelectRequest={selectRequest}
              selectedRequestId={activeTabId ?? selectedRequestId ?? null}
              environments={environments}
              renaming={renaming}
              onRenameChange={(value) => setRenaming((prev) => (prev ? { ...prev, value } : null))}
              onRenameFinish={handleFinishRename}
              matchingRequestIds={matchingRequestIds}
              visibleCollectionIds={visibleCollectionIds}
            />
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
      {envPickerCollectionId && (
        <Modal title="Set Environment" onClose={() => setEnvPickerCollectionId(null)}>
          <div className="flex flex-col gap-1">
            {Array.from(environments.values()).map((env) => {
              const col = collections.find((c) => c.id === envPickerCollectionId)
              const isActive = col?.environment_id === env.id
              return (
                <button
                  key={env.id}
                  onClick={() => handleSetEnvironment(envPickerCollectionId, env.id)}
                  className={`rounded px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-op-primary text-white' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {env.name}
                </button>
              )
            })}
            {collections.find((c) => c.id === envPickerCollectionId)?.environment_id && (
              <>
                <div className="my-1 border-t border-white/10" />
                <button
                  onClick={() => handleSetEnvironment(envPickerCollectionId, null)}
                  className="rounded px-3 py-2 text-left text-sm text-white/50 transition-colors hover:bg-white/10"
                >
                  Remove Environment
                </button>
              </>
            )}
            {environments.size === 0 && (
              <p className="py-2 text-center text-sm text-white/40">No environments available</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function CollectionNode({
  collection,
  depth,
  expandedIds,
  onToggle,
  onCollectionContextMenu,
  onRequestContextMenu,
  getChildCollections,
  getCollectionRequests,
  onSelectRequest,
  selectedRequestId,
  environments,
  renaming,
  onRenameChange,
  onRenameFinish,
  matchingRequestIds,
  visibleCollectionIds
}: {
  collection: Collection
  depth: number
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onCollectionContextMenu: (e: React.MouseEvent, collectionId: string) => void
  onRequestContextMenu: (e: React.MouseEvent, requestId: string) => void
  getChildCollections: (parentId: string) => Collection[]
  getCollectionRequests: (collectionId: string) => Request[]
  onSelectRequest: (request: Request) => void
  selectedRequestId: string | null
  environments: Map<string, Environment>
  renaming: RenameState | null
  onRenameChange: (value: string) => void
  onRenameFinish: () => void
  matchingRequestIds: Set<string> | null
  visibleCollectionIds: Set<string> | null
}): React.JSX.Element {
  const isSearching = visibleCollectionIds !== null
  const expanded = expandedIds.has(collection.id)
  const allChildren = getChildCollections(collection.id)
  const children = isSearching
    ? allChildren.filter((c) => visibleCollectionIds.has(c.id))
    : allChildren
  const allRequests = getCollectionRequests(collection.id)
  const requests = isSearching
    ? allRequests.filter((r) => matchingRequestIds!.has(r.id))
    : allRequests
  const envName = collection.environment_id
    ? environments.get(collection.environment_id)?.name
    : null

  return (
    <div>
      <button
        onClick={() => onToggle(collection.id)}
        onContextMenu={(e) => onCollectionContextMenu(e, collection.id)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
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
          className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
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
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        {renaming?.id === collection.id ? (
          <input
            autoFocus
            value={renaming.value}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameFinish}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameFinish()
              if (e.key === 'Escape') onRenameFinish()
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded bg-white/10 px-1 py-0.5 text-sm text-white outline-none focus:bg-white/20"
          />
        ) : (
          <>
            <span className="truncate">{collection.name}</span>
            {envName && (
              <span className="ml-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                {envName}
              </span>
            )}
          </>
        )}
      </button>
      {expanded && (
        <div>
          {children.map((child) => (
            <CollectionNode
              key={child.id}
              collection={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onCollectionContextMenu={onCollectionContextMenu}
              onRequestContextMenu={onRequestContextMenu}
              getChildCollections={getChildCollections}
              getCollectionRequests={getCollectionRequests}
              onSelectRequest={onSelectRequest}
              selectedRequestId={selectedRequestId}
              environments={environments}
              renaming={renaming}
              onRenameChange={onRenameChange}
              onRenameFinish={onRenameFinish}
              matchingRequestIds={matchingRequestIds}
              visibleCollectionIds={visibleCollectionIds}
            />
          ))}
          {requests.map((req) => (
            <button
              key={req.id}
              onClick={() => onSelectRequest(req)}
              onContextMenu={(e) => onRequestContextMenu(e, req.id)}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                selectedRequestId === req.id
                  ? 'bg-white/15 text-white'
                  : 'text-white/70 hover:bg-white/10'
              }`}
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              <span
                className={`w-12 shrink-0 text-xs font-bold ${METHOD_COLORS[req.method] ?? 'text-white/50'}`}
              >
                {req.method}
              </span>
              {renaming?.id === req.id ? (
                <input
                  autoFocus
                  value={renaming.value}
                  onChange={(e) => onRenameChange(e.target.value)}
                  onBlur={onRenameFinish}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onRenameFinish()
                    if (e.key === 'Escape') onRenameFinish()
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 rounded bg-white/10 px-1 py-0.5 text-sm text-white outline-none focus:bg-white/20"
                />
              ) : (
                <span className="truncate">{req.name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
