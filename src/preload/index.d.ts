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
      getAppVersion: () => Promise<string>
      downloadUpdate: () => void
      installUpdate: () => void
      onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
      onUpdateDownloaded: (cb: () => void) => () => void
      onUpdateProgress: (cb: (info: { percent: number }) => void) => () => void
    }
  }
}
