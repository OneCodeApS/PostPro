import { useState } from 'react'
import { getBodyForRequest } from './BodyEditor'

interface CurlSidebarProps {
  method: string
  url: string
  params: { key: string; value: string; enabled: boolean }[]
  headers: { key: string; value: string; enabled: boolean }[]
  body: string
}

function generateCurl({ method, url, params, headers, body }: CurlSidebarProps): string {
  const parts: string[] = ['curl']

  if (method !== 'GET') {
    parts.push(`-X ${method}`)
  }

  const queryString = params
    .filter((p) => p.enabled && p.key)
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&')
  const fullUrl = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url
  parts.push(`'${fullUrl}'`)

  for (const h of headers) {
    if (h.enabled && h.key) {
      parts.push(`-H '${h.key}: ${h.value}'`)
    }
  }

  const resolved = getBodyForRequest(body)
  if (resolved.body && !['GET', 'HEAD'].includes(method)) {
    const hasContentType = headers.some((h) => h.enabled && h.key.toLowerCase() === 'content-type')
    if (!hasContentType && resolved.contentType) {
      parts.push(`-H 'Content-Type: ${resolved.contentType}'`)
    }
    parts.push(`-d '${resolved.body}'`)
  }

  return parts.join(' \\\n  ')
}

export function CurlSidebar(props: CurlSidebarProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const curl = generateCurl(props)

  return (
    <div className="flex">
      <button
        onClick={() => setOpen(!open)}
        title="cURL"
        className="flex w-8 items-center justify-center border-l border-white/10 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
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
          <polyline points={open ? '13 17 18 12 13 7' : '11 17 6 12 11 7'} />
          <polyline points={open ? '6 17 11 12 6 7' : '18 17 13 12 18 7'} />
        </svg>
      </button>

      {open && (
        <div className="flex w-80 flex-col border-l border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-xs font-medium text-white/50">cURL</span>
            <button
              onClick={() => navigator.clipboard.writeText(curl)}
              className="rounded px-2 py-0.5 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
            >
              Copy
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <pre className="whitespace-pre-wrap font-mono text-xs text-white/70">{curl}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
