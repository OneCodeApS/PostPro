import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTabs, type CachedResponse } from '../../contexts/TabContext'
import { supabase } from '../../lib/supabase'
import { RequestService } from '../../services/RequestService'
import { Button } from '../reusable/Button'
import { VariableInput } from '../reusable/VariableInput'
import { CurlSidebar } from './CurlSidebar'
import { BodyEditor, getBodyForRequest } from './BodyEditor'
import { BoardSearch } from '../reusable/BoardSearch'
import { SchemaTab } from './SchemaTab'
import { ResponsePanel } from './ResponsePanel'
import { EnvironmentService } from '../../services/EnvironmentService'
import type { Request, EnvironmentVariable } from '../../types'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-gray-400'
}

const requestService = new RequestService(supabase)
const environmentService = new EnvironmentService(supabase)

type Tab = 'params' | 'headers' | 'body' | 'schema'

interface KeyValueRow {
  key: string
  value: string
  enabled: boolean
}

export function RequestDetail({
  requestId: propRequestId
}: { requestId?: string } = {}): React.JSX.Element {
  const params_ = useParams<{ requestId: string }>()
  const requestId = propRequestId ?? params_.requestId
  const { setTabDirty, updateTab, getResponse, setResponse: setCachedResponse } = useTabs()
  const [request, setRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('params')
  const [sending, setSending] = useState(false)
  const cancelledRef = useRef(false)

  // Response state backed by TabContext cache
  const cached = requestId ? getResponse(requestId) : { response: null, error: null }
  const response = cached.response
  const responseError = cached.error

  function setResponse(r: CachedResponse | null): void {
    if (requestId) setCachedResponse(requestId, r, null)
  }
  function setResponseError(err: string | null): void {
    if (requestId) setCachedResponse(requestId, null, err)
  }
  const [envVariables, setEnvVariables] = useState<EnvironmentVariable[]>([])
  const [envId, setEnvId] = useState<string | null>(null)
  const [envName, setEnvName] = useState<string | null>(null)
  const navigate = useNavigate()

  // Local editable state
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [params, setParams] = useState<KeyValueRow[]>([])
  const [headers, setHeaders] = useState<KeyValueRow[]>([])
  const [body, setBody] = useState('')
  const [schema, setSchema] = useState('')
  const [methodDropdownOpen, setMethodDropdownOpen] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Snapshot of the last saved state for dirty comparison
  const savedState = useRef<string>('')

  function currentStateSnapshot(): string {
    return JSON.stringify({ method, url, params, headers, body, schema })
  }

  function checkDirty(): void {
    setDirty(currentStateSnapshot() !== savedState.current)
  }

  // Wrap setters to mark dirty
  function setMethodTracked(v: string): void {
    setMethod(v)
  }
  function setUrlTracked(v: string): void {
    setUrl(v)
  }
  function setParamsTracked(v: KeyValueRow[]): void {
    setParams(v)
  }
  function setHeadersTracked(v: KeyValueRow[]): void {
    setHeaders(v)
  }
  function setBodyTracked(v: string): void {
    setBody(v)
  }
  function setSchemaTracked(v: string): void {
    setSchema(v)
  }

  // Check dirty after every render where editable state changes
  useEffect(() => {
    checkDirty()
  }, [method, url, params, headers, body, schema])

  // Report dirty state and method/name to tab context
  useEffect(() => {
    if (requestId) setTabDirty(requestId, dirty)
  }, [dirty, requestId])

  useEffect(() => {
    if (requestId && request) updateTab(requestId, { name: request.name, method })
  }, [method, request?.name, requestId])

  async function loadRequest(): Promise<void> {
    if (!requestId) return
    const { data, error } = await supabase
      .from('postpro_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (error) {
      console.error('Failed to load request:', error)
      setLoading(false)
      return
    }

    setRequest(data)

    // Load environment variables from the request's collection (walk up parent chain)
    let resolvedEnvId: string | null = null
    if (data.collection_id) {
      let currentId: string | null = data.collection_id
      while (currentId && !resolvedEnvId) {
        const { data: col } = await supabase
          .from('postpro_collections')
          .select('environment_id, parent_collection_id')
          .eq('id', currentId)
          .single()
        if (col?.environment_id) {
          resolvedEnvId = col.environment_id
        } else {
          currentId = col?.parent_collection_id ?? null
        }
      }
      if (resolvedEnvId) {
        const vars = await environmentService.getVariables(resolvedEnvId)
        setEnvVariables(vars)
        const { data: env } = await supabase
          .from('postpro_environments')
          .select('name')
          .eq('id', resolvedEnvId)
          .single()
        setEnvId(resolvedEnvId)
        setEnvName(env?.name ?? null)
      } else {
        setEnvVariables([])
        setEnvId(null)
        setEnvName(null)
      }
    } else {
      setEnvId(null)
      setEnvName(null)
    }

    setMethod(data.method || 'GET')
    setUrl(data.url || '')
    setParams(data.query_params?.length ? data.query_params : [])
    setHeaders(data.headers?.length ? data.headers : [])
    setBody(data.body || '')
    const schemaStr = data.schema ? JSON.stringify(data.schema, null, 2) : ''
    setSchema(schemaStr)
    setLoading(false)

    // Set initial saved snapshot after state is set
    savedState.current = JSON.stringify({
      method: data.method || 'GET',
      url: data.url || '',
      params: data.query_params?.length ? data.query_params : [],
      headers: data.headers?.length ? data.headers : [],
      body: data.body || '',
      schema: schemaStr
    })
    setDirty(false)
  }

  useEffect(() => {
    setLoading(true)
    void (async () => {
      await loadRequest()
    })()
  }, [requestId])

  const handleSave = useCallback(async (): Promise<void> => {
    if (!requestId) return
    let parsedSchema: unknown = null
    if (schema.trim()) {
      try {
        parsedSchema = JSON.parse(schema)
      } catch {
        parsedSchema = request?.schema ?? null
      }
    }
    await requestService.update(requestId, {
      method,
      url,
      query_params: params,
      headers,
      body: body || null,
      schema: parsedSchema
    })
    savedState.current = currentStateSnapshot()
    setDirty(false)
  }, [requestId, method, url, params, headers, body, schema, request])

  // Ctrl+S to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // Listen for save events from tab context menu
  useEffect(() => {
    function handleSaveEvent(e: Event): void {
      const detail = (e as CustomEvent).detail
      if (detail?.requestId === requestId) {
        void handleSave()
      }
    }
    window.addEventListener('postpro-save-request', handleSaveEvent)
    return () => window.removeEventListener('postpro-save-request', handleSaveEvent)
  }, [handleSave, requestId])

  function handleCancel(): void {
    cancelledRef.current = true
    window.api.abortRequest()
    setSending(false)
  }

  async function handleSend(): Promise<void> {
    if (!url.trim()) return
    cancelledRef.current = false
    setSending(true)
    setResponse(null)
    setResponseError(null)

    // Save before sending
    await handleSave()
    if (cancelledRef.current) return

    // Resolve all variables including secrets from vault (walk up parent chain)
    let resolvedVars: { key: string; value: string }[] = []
    if (request?.collection_id) {
      let envId: string | null = null
      let currentId: string | null = request.collection_id
      while (currentId && !envId) {
        const { data: col } = await supabase
          .from('postpro_collections')
          .select('environment_id, parent_collection_id')
          .eq('id', currentId)
          .single()
        if (col?.environment_id) {
          envId = col.environment_id
        } else {
          currentId = col?.parent_collection_id ?? null
        }
      }
      if (envId) {
        resolvedVars = await environmentService.getResolvedVariables(envId)
      }
    }

    if (cancelledRef.current) return

    // Interpolate variables: replace {varName} with resolved variable values
    function interpolate(text: string): string {
      return text.replace(/\{(\w+)\}/g, (match, key) => {
        const v = resolvedVars.find((ev) => ev.key === key)
        return v ? v.value : match
      })
    }

    // Build query string from enabled params
    const queryString = params
      .filter((p) => p.enabled && p.key)
      .map(
        (p) =>
          `${encodeURIComponent(interpolate(p.key))}=${encodeURIComponent(interpolate(p.value))}`
      )
      .join('&')

    const resolvedUrl = interpolate(url)
    const fullUrl = queryString
      ? `${resolvedUrl}${resolvedUrl.includes('?') ? '&' : '?'}${queryString}`
      : resolvedUrl

    // Build headers
    const reqHeaders: Record<string, string> = {}
    for (const h of headers) {
      if (h.enabled && h.key) reqHeaders[interpolate(h.key)] = interpolate(h.value)
    }

    // Resolve body type and content, then interpolate the extracted body
    const resolved = getBodyForRequest(body)
    if (resolved.body) resolved.body = interpolate(resolved.body)
    if (resolved.contentType && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = resolved.contentType
    }

    try {
      const res = await window.api.httpRequest({
        url: fullUrl,
        method,
        headers: reqHeaders,
        body: ['GET', 'HEAD'].includes(method) ? undefined : (resolved.body ?? undefined)
      })

      if (res.error) {
        setResponseError(res.error)
      } else {
        setResponse({
          status: res.status!,
          statusText: res.statusText!,
          headers: res.headers!,
          body: res.body!,
          time: res.time!
        })
      }
    } catch (err) {
      setResponseError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSending(false)
    }
  }

  function updateRow(
    rows: KeyValueRow[],
    setRows: (rows: KeyValueRow[]) => void,
    index: number,
    updates: Partial<KeyValueRow>
  ): void {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...updates } : r)))
  }

  function addRow(
    rows: KeyValueRow[],
    setRows: (rows: KeyValueRow[]) => void
  ): void {
    setRows([...rows, { key: '', value: '', enabled: true }])
  }

  function removeRow(
    rows: KeyValueRow[],
    setRows: (rows: KeyValueRow[]) => void,
    index: number
  ): void {
    setRows(rows.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-op-disabled">
        Loading...
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-op-disabled">
        Request not found
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'params', label: 'Params' },
    { id: 'headers', label: 'Headers' },
    { id: 'body', label: 'Body' },
    { id: 'schema', label: 'Schema' }
  ]

  return (
    <div className="flex h-full bg-op-primary">
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* URL bar */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          {/* Method dropdown */}
          <div className="relative">
            <button
              onClick={() => setMethodDropdownOpen(!methodDropdownOpen)}
              className={`flex w-24 items-center justify-between rounded bg-white/10 px-3 py-2 text-sm font-bold ${METHOD_COLORS[method] ?? 'text-white'}`}
            >
              {method}
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
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {methodDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-28 rounded-lg border border-white/10 bg-op-primary py-1 shadow-lg">
                {HTTP_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMethodTracked(m)
                      setMethodDropdownOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-sm font-bold transition-colors hover:bg-white/10 ${METHOD_COLORS[m]}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* URL input with query params preview */}
          <div className="flex flex-1 items-center rounded bg-white/10 focus-within:bg-white/15">
            <VariableInput
              value={url}
              onChange={setUrlTracked}
              variables={envVariables}
              placeholder="https://api.example.com/endpoint"
              className="min-w-0 w-full bg-transparent px-3 py-3 text-sm text-white placeholder-white/30 outline-none"
            />
            {params.some((p) => p.enabled && p.key) && (
              <span className="shrink-0 truncate pr-3 text-xs text-white/30">
                {(url.includes('?') ? '&' : '?') +
                  params
                    .filter((p) => p.enabled && p.key)
                    .map((p) => `${p.key}=${p.value}`)
                    .join('&')}
              </span>
            )}
          </div>

          {/* Environment badge + Board link + Send button */}
          {envName && (
            <button
              onClick={() => navigate(`/environments/${envId}`)}
              className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/15 hover:text-white/80"
              title={`Go to ${envName} environment`}
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
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              {envName}
            </button>
          )}
          <BoardSearch requestId={requestId!} />
          {sending ? (
            <Button variant="secondary" size="md" onClick={handleCancel}>
              Cancel..
            </Button>
          ) : (
            <Button variant="tertiary" size="md" onClick={handleSend}>
              Send
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-op-primary text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'params' && (
            <KeyValueEditor
              label="param"
              rows={params}
              onChange={setParamsTracked}
              updateRow={updateRow}
              addRow={addRow}
              removeRow={removeRow}
              variables={envVariables}
            />
          )}
          {activeTab === 'headers' && (
            <KeyValueEditor
              label="header"
              rows={headers}
              onChange={setHeadersTracked}
              updateRow={updateRow}
              addRow={addRow}
              removeRow={removeRow}
              variables={envVariables}
            />
          )}
          {activeTab === 'body' && (
            <BodyEditor value={body} onChange={setBodyTracked} variables={envVariables} />
          )}
          {activeTab === 'schema' && (
            <SchemaTab schema={schema} onChange={setSchemaTracked} response={response} />
          )}
        </div>

        {/* Response */}
        <ResponsePanel response={response} responseError={responseError} sending={sending} />
      </div>

      <CurlSidebar method={method} url={url} params={params} headers={headers} body={body} />
    </div>
  )
}

function KeyValueEditor({
  label,
  rows,
  onChange,
  updateRow,
  addRow,
  removeRow,
  variables
}: {
  label: string
  rows: KeyValueRow[]
  onChange: (rows: KeyValueRow[]) => void
  updateRow: (
    rows: KeyValueRow[],
    setRows: (rows: KeyValueRow[]) => void,
    index: number,
    updates: Partial<KeyValueRow>
  ) => void
  addRow: (rows: KeyValueRow[], setRows: (rows: KeyValueRow[]) => void) => void
  removeRow: (rows: KeyValueRow[], setRows: (rows: KeyValueRow[]) => void, index: number) => void
  variables: EnvironmentVariable[]
}): React.JSX.Element {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/10 text-left text-xs text-white/50">
          <th className="w-8 px-4 py-2"></th>
          <th className="w-1/2 px-4 py-2 font-medium">Key</th>
          <th className="w-1/2 px-4 py-2 font-medium">Value</th>
          <th className="w-10 px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="group border-b border-white/5">
            <td className="px-4 py-1.5">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => updateRow(rows, onChange, i, { enabled: e.target.checked })}
                className="accent-op-primary"
              />
            </td>
            <td className="px-4 py-1.5">
              <input
                value={row.key}
                onChange={(e) => updateRow(rows, onChange, i, { key: e.target.value })}
                placeholder="key"
                className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
              />
            </td>
            <td className="px-4 py-1.5">
              <VariableInput
                value={row.value}
                onChange={(v) => updateRow(rows, onChange, i, { value: v })}
                variables={variables}
                placeholder="value"
                className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
              />
            </td>
            <td className="px-4 py-1.5">
              <button
                onClick={() => removeRow(rows, onChange, i)}
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
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </td>
          </tr>
        ))}
        <tr>
          <td colSpan={4} className="px-4 py-1.5">
            <button
              onClick={() => addRow(rows, onChange)}
              className="text-xs text-white/30 transition-colors hover:text-white/60"
            >
              + Add new {label}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
