import { useState, useRef, useCallback } from 'react'
import { VariableInput } from '../reusable/VariableInput'
import type { EnvironmentVariable } from '../../types'

type BodyType = 'none' | 'json' | 'form-data' | 'raw'

interface FormDataRow {
  key: string
  value: string
  enabled: boolean
}

interface BodyEditorProps {
  value: string
  onChange: (value: string) => void
  variables: EnvironmentVariable[]
}

function parseBodyState(value: string): { type: BodyType; json: string; formData: FormDataRow[]; raw: string } {
  // Try to detect what type the stored body is
  let json = ''
  let formData: FormDataRow[] = [{ key: '', value: '', enabled: true }]
  let raw = ''
  let type: BodyType = 'json'

  if (!value) {
    return { type: 'json', json: '', formData, raw: '' }
  }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && parsed.__bodyType) {
      type = parsed.__bodyType as BodyType
      json = parsed.json ?? ''
      formData = parsed.formData?.length ? parsed.formData : [{ key: '', value: '', enabled: true }]
      raw = parsed.raw ?? ''
      return { type, json, formData, raw }
    }
  } catch {
    // not our envelope format
  }

  // Legacy: plain string body, treat as JSON
  json = value
  return { type: 'json', json, formData, raw }
}

function serializeBodyState(type: BodyType, json: string, formData: FormDataRow[], raw: string): string {
  return JSON.stringify({ __bodyType: type, json, formData, raw })
}

export function getBodyForRequest(
  bodyValue: string
): { contentType: string | null; body: string | null } {
  if (!bodyValue) return { contentType: null, body: null }

  try {
    const parsed = JSON.parse(bodyValue)
    if (parsed && typeof parsed === 'object' && parsed.__bodyType) {
      const type = parsed.__bodyType as BodyType
      if (type === 'none') return { contentType: null, body: null }
      if (type === 'json') {
        return { contentType: 'application/json', body: parsed.json || null }
      }
      if (type === 'form-data') {
        const rows: FormDataRow[] = parsed.formData ?? []
        const fd = new URLSearchParams()
        for (const r of rows) {
          if (r.enabled && r.key) fd.append(r.key, r.value)
        }
        const str = fd.toString()
        return { contentType: 'application/x-www-form-urlencoded', body: str || null }
      }
      if (type === 'raw') {
        return { contentType: 'text/plain', body: parsed.raw || null }
      }
    }
  } catch {
    // legacy plain body
  }

  return { contentType: 'application/json', body: bodyValue || null }
}

export function BodyEditor({ value, onChange, variables }: BodyEditorProps): React.JSX.Element {
  const initial = parseBodyState(value)
  const [bodyType, setBodyType] = useState<BodyType>(initial.type)
  const [json, setJson] = useState(initial.json)
  const [formData, setFormData] = useState<FormDataRow[]>(initial.formData)
  const [raw, setRaw] = useState(initial.raw)
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Track last value prop to detect external changes (e.g. loading a different request)
  const lastValueRef = useRef(value)
  const lastSerializedRef = useRef(serializeBodyState(initial.type, initial.json, initial.formData, initial.raw))

  if (value !== lastValueRef.current && value !== lastSerializedRef.current) {
    // External change — re-parse
    const parsed = parseBodyState(value)
    setBodyType(parsed.type)
    setJson(parsed.json)
    setFormData(parsed.formData)
    setRaw(parsed.raw)
    lastValueRef.current = value
    lastSerializedRef.current = value
  }

  const emit = useCallback(
    (type: BodyType, j: string, fd: FormDataRow[], r: string) => {
      const serialized = serializeBodyState(type, j, fd, r)
      lastSerializedRef.current = serialized
      lastValueRef.current = serialized
      onChange(serialized)
    },
    [onChange]
  )

  function handleJsonChange(v: string): void {
    setJson(v)
    emit(bodyType, v, formData, raw)
    if (!v.trim()) {
      setJsonError(null)
      return
    }
    try {
      JSON.parse(v)
      setJsonError(null)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  function formatJson(): void {
    try {
      const parsed = JSON.parse(json)
      const formatted = JSON.stringify(parsed, null, 2)
      setJson(formatted)
      emit(bodyType, formatted, formData, raw)
      setJsonError(null)
    } catch {
      // already showing error
    }
  }

  function handleBodyTypeChange(type: BodyType): void {
    setBodyType(type)
    emit(type, json, formData, raw)
  }

  function updateFormRow(index: number, updates: Partial<FormDataRow>): void {
    const next = formData.map((r, i) => (i === index ? { ...r, ...updates } : r))
    // Auto-add empty row at end
    const last = next[next.length - 1]
    if (last && (last.key || last.value)) {
      next.push({ key: '', value: '', enabled: true })
    }
    setFormData(next)
    emit(bodyType, json, next, raw)
  }

  function removeFormRow(index: number): void {
    if (formData.length <= 1) return
    const next = formData.filter((_, i) => i !== index)
    setFormData(next)
    emit(bodyType, json, next, raw)
  }

  function handleRawChange(v: string): void {
    setRaw(v)
    emit(bodyType, json, formData, v)
  }

  const tabs: { id: BodyType; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'json', label: 'JSON' },
    { id: 'form-data', label: 'Form Data' },
    { id: 'raw', label: 'Raw' }
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-white/5 px-4 py-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleBodyTypeChange(tab.id)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              bodyType === tab.id
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {bodyType === 'json' && json.trim() && (
          <button
            onClick={formatJson}
            className="ml-auto text-xs text-white/30 transition-colors hover:text-white/60"
          >
            Format
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {bodyType === 'none' && (
          <div className="flex h-full items-center justify-center text-sm text-white/30">
            No body
          </div>
        )}

        {bodyType === 'json' && (
          <div className="relative h-full p-4">
            <VariableInput
              value={json}
              onChange={handleJsonChange}
              variables={variables}
              placeholder='{"key": "value"}'
              className="h-full min-h-48 w-full rounded bg-white/5 p-3 font-mono text-sm text-white placeholder-white/30 focus:bg-white/10"
              multiline
              syntax="json"
            />
            {jsonError && (
              <div className="absolute bottom-6 left-6 right-6 rounded bg-op-error/10 px-3 py-1.5 text-xs text-op-error">
                {jsonError}
              </div>
            )}
          </div>
        )}

        {bodyType === 'form-data' && (
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
              {formData.map((row, i) => (
                <tr key={i} className="group border-b border-white/5">
                  <td className="px-4 py-1.5">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => updateFormRow(i, { enabled: e.target.checked })}
                      className="accent-op-primary"
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    <VariableInput
                      value={row.key}
                      onChange={(v) => updateFormRow(i, { key: v })}
                      variables={variables}
                      placeholder="key"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    <VariableInput
                      value={row.value}
                      onChange={(v) => updateFormRow(i, { value: v })}
                      variables={variables}
                      placeholder="value"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder-white/30"
                    />
                  </td>
                  <td className="px-4 py-1.5">
                    {formData.length > 1 && (
                      <button
                        onClick={() => removeFormRow(i)}
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
        )}

        {bodyType === 'raw' && (
          <div className="h-full p-4">
            <VariableInput
              value={raw}
              onChange={handleRawChange}
              variables={variables}
              placeholder="Raw body content"
              className="h-full min-h-48 w-full rounded bg-white/5 p-3 font-mono text-sm text-white placeholder-white/30 focus:bg-white/10"
              multiline
            />
          </div>
        )}
      </div>
    </div>
  )
}
