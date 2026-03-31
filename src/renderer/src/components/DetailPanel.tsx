import type { Environment, Request } from '../types'

interface DetailPanelProps {
  selectedEnvironment: Environment | null
  selectedRequest: Request | null
}

export function DetailPanel({
  selectedEnvironment,
  selectedRequest
}: DetailPanelProps): React.JSX.Element {
  if (selectedRequest) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-op-disabled">
        Request detail coming soon
      </div>
    )
  }

  if (selectedEnvironment) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-op-disabled">
        Environment selected
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-op-disabled bg-op-primary">
      Select a request or environment to view details
    </div>
  )
}
