import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { RequestService } from '../../services/RequestService'
import { Button } from '../reusable/Button'
import { VariableInput } from '../reusable/VariableInput'
import { CurlSidebar } from './CurlSidebar'
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

interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
}

export function RequestDetail(): React.JSX.Element {
  const { requestId } = useParams<{ requestId: string }>()
  const [request, setRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('params')
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState<ResponseState | null>(null)
  const [responseError, setResponseError] = useState<string | null>(null)
  const [envVariables, setEnvVariables] = useState<EnvironmentVariable[]>([])

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

    // Load environment variables from the request's collection
    if (data.collection_id) {
      const { data: col } = await supabase
        .from('postpro_collections')
        .select('environment_id')
        .eq('id', data.collection_id)
        .single()

      if (col?.environment_id) {
        const vars = await environmentService.getVariables(col.environment_id)
        setEnvVariables(vars)
      } else {
        setEnvVariables([])
      }
    }

    setMethod(data.method || 'GET')
    setUrl(data.url || '')
    setParams(
      data.query_params?.length ? data.query_params : [{ key: '', value: '', enabled: false }]
    )
    setHeaders(data.headers?.length ? data.headers : [{ key: '', value: '', enabled: false }])
    setBody(data.body || '')
    const schemaStr = data.schema ? JSON.stringify(data.schema, null, 2) : ''
    setSchema(schemaStr)
    setLoading(false)

    // Set initial saved snapshot after state is set
    savedState.current = JSON.stringify({
      method: data.method || 'GET',
      url: data.url || '',
      params: data.query_params?.length
        ? data.query_params
        : [{ key: '', value: '', enabled: false }],
      headers: data.headers?.length ? data.headers : [{ key: '', value: '', enabled: false }],
      body: data.body || '',
      schema: schemaStr
    })
    setDirty(false)
  }

  useEffect(() => {
    setLoading(true)
    setResponse(null)
    setResponseError(null)
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

  async function handleSend(): Promise<void> {
    if (!url.trim()) return
    setSending(true)
    setResponse(null)
    setResponseError(null)

    // Save before sending
    await handleSave()

    // Build query string from enabled params
    const queryString = params
      .filter((p) => p.enabled && p.key)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&')

    const fullUrl = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url

    // Build headers
    const reqHeaders: Record<string, string> = {}
    for (const h of headers) {
      if (h.enabled && h.key) reqHeaders[h.key] = h.value
    }

    // Add content-type for body methods
    if (body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json'
    }

    const startTime = performance.now()

    try {
      const res = await fetch(fullUrl, {
        method,
        headers: reqHeaders,
        body: ['GET', 'HEAD'].includes(method) ? undefined : body || undefined
      })

      const elapsed = Math.round(performance.now() - startTime)
      const resBody = await res.text()

      const resHeaders: Record<string, string> = {}
      res.headers.forEach((val, key) => {
        resHeaders[key] = val
      })

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        time: elapsed
      })
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
    const updated = rows.map((r, i) => (i === index ? { ...r, ...updates } : r))
    // Auto-add empty row at end
    const last = updated[updated.length - 1]
    if (last && (last.key || last.value)) {
      updated.push({ key: '', value: '', enabled: false })
    }
    setRows(updated)
  }

  function removeRow(
    rows: KeyValueRow[],
    setRows: (rows: KeyValueRow[]) => void,
    index: number
  ): void {
    if (rows.length <= 1) return
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

          {/* Send button */}
          <Button size="md" onClick={handleSend} disabled={sending}>
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>

        {/* Unsaved indicator */}
        {dirty && (
          <div className="flex items-center gap-2 border-b border-white/10 bg-op-warning/10 px-4 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-op-warning" />
            <span className="text-xs text-op-warning">Unsaved changes</span>
            <span className="text-xs text-white/30">Ctrl+S to save</span>
          </div>
        )}

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
              rows={params}
              onChange={setParamsTracked}
              updateRow={updateRow}
              removeRow={removeRow}
              variables={envVariables}
            />
          )}
          {activeTab === 'headers' && (
            <KeyValueEditor
              rows={headers}
              onChange={setHeadersTracked}
              updateRow={updateRow}
              removeRow={removeRow}
              variables={envVariables}
            />
          )}
          {activeTab === 'body' && (
            <div className="h-full p-4">
              <textarea
                value={body}
                onChange={(e) => setBodyTracked(e.target.value)}
                placeholder='{"key": "value"}'
                className="h-full min-h-48 w-full resize-none rounded bg-white/5 p-3 font-mono text-sm text-white placeholder-white/30 outline-none focus:bg-white/10"
              />
            </div>
          )}
          {activeTab === 'schema' && (
            <div className="h-full p-4">
              <textarea
                value={schema}
                onChange={(e) => setSchemaTracked(e.target.value)}
                placeholder="JSON Schema"
                className="h-full min-h-48 w-full resize-none rounded bg-white/5 p-3 font-mono text-sm text-white placeholder-white/30 outline-none focus:bg-white/10"
              />
            </div>
          )}
        </div>

        {/* Response */}
        {(response || responseError) && (
          <div className="border-t border-white/10">
            <div className="flex items-center gap-3 px-4 py-2">
              <span className="text-xs font-medium text-white/50">Response</span>
              {response && (
                <>
                  <span
                    className={`text-xs font-bold ${
                      response.status < 300
                        ? 'text-op-success'
                        : response.status < 400
                          ? 'text-op-warning'
                          : 'text-op-error'
                    }`}
                  >
                    {response.status} {response.statusText}
                  </span>
                  <span className="text-xs text-white/40">{response.time}ms</span>
                </>
              )}
              {responseError && <span className="text-xs text-op-error">{responseError}</span>}
            </div>
            {response && (
              <div className="max-h-64 overflow-y-auto px-4 pb-4">
                <pre className="whitespace-pre-wrap rounded bg-white/5 p-3 font-mono text-xs text-white/80">
                  {formatResponseBody(response.body)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <CurlSidebar method={method} url={url} params={params} headers={headers} body={body} />
    </div>
  )
}

function KeyValueEditor({
  rows,
  onChange,
  updateRow,
  removeRow,
  variables
}: {
  rows: KeyValueRow[]
  onChange: (rows: KeyValueRow[]) => void
  updateRow: (
    rows: KeyValueRow[],
    setRows: (rows: KeyValueRow[]) => void,
    index: number,
    updates: Partial<KeyValueRow>
  ) => void
  removeRow: (rows: KeyValueRow[], setRows: (rows: KeyValueRow[]) => void, index: number) => void
  variables: EnvironmentVariable[]
}): React.JSX.Element {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-white/10 text-left text-xs text-white/50">
          <th className="w-8 px-4 py-2"></th>
          <th className="px-4 py-2 font-medium">Key</th>
          <th className="px-4 py-2 font-medium">Value</th>
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
              {rows.length > 1 && (
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
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}
