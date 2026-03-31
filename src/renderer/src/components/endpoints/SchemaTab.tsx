interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
}

interface SchemaTabProps {
  schema: string
  onChange: (v: string) => void
  response: ResponseState | null
}

function generateJsonSchema(value: unknown): Record<string, unknown> {
  if (value === null) return { type: 'null' }
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: 'array', items: {} }
    return { type: 'array', items: generateJsonSchema(value[0]) }
  }
  if (typeof value === 'object') {
    const properties: Record<string, unknown> = {}
    const required: string[] = []
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      properties[k] = generateJsonSchema(v)
      required.push(k)
    }
    return { type: 'object', properties, required }
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' }
  }
  return { type: typeof value }
}

export function SchemaTab({ schema, onChange, response }: SchemaTabProps): React.JSX.Element {
  function generateFromResponse(): void {
    if (!response) return
    try {
      const parsed = JSON.parse(response.body)
      const generated = generateJsonSchema(parsed)
      onChange(JSON.stringify(generated, null, 2))
    } catch {
      // response body isn't valid JSON
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-1.5">
        <button
          onClick={generateFromResponse}
          disabled={!response}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            response
              ? 'bg-white/10 text-white hover:bg-white/15'
              : 'cursor-not-allowed text-white/20'
          }`}
        >
          Generate from Response
        </button>
        {!response && (
          <span className="text-xs text-white/30">Send a request first</span>
        )}
      </div>
      <div className="flex-1 p-4">
        <textarea
          value={schema}
          onChange={(e) => onChange(e.target.value)}
          placeholder="JSON Schema — click Generate from Response or write manually"
          className="h-full min-h-48 w-full resize-none rounded bg-white/5 p-3 font-mono text-sm text-white placeholder-white/30 outline-none focus:bg-white/10"
        />
      </div>
    </div>
  )
}
