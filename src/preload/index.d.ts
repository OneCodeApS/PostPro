import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      httpRequest: (opts: {
        url: string
        method: string
        headers: Record<string, string>
        body?: string
      }) => Promise<{
        status?: number
        statusText?: string
        headers?: Record<string, string>
        body?: string
        time?: number
        error?: string
      }>
      windowMinimize: () => void
      windowMaximize: () => void
      windowClose: () => void
    }
  }
}
