import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  httpRequest: (opts: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }): Promise<{
    status?: number
    statusText?: string
    headers?: Record<string, string>
    body?: string
    time?: number
    error?: string
  }> => ipcRenderer.invoke('http-request', opts),
  checkForUpdates: (): void => ipcRenderer.send('check-for-updates'),
  windowMinimize: (): void => ipcRenderer.send('window-minimize'),
  windowMaximize: (): void => ipcRenderer.send('window-maximize'),
  windowClose: (): void => ipcRenderer.send('window-close'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  downloadUpdate: (): void => ipcRenderer.send('download-update'),
  installUpdate: (): void => ipcRenderer.send('install-update'),
  onUpdateAvailable: (cb: (info: { version: string }) => void): (() => void) => {
    const handler = (_: unknown, info: { version: string }): void => cb(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateDownloaded: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },
  onUpdateProgress: (cb: (info: { percent: number }) => void): (() => void) => {
    const handler = (_: unknown, info: { percent: number }): void => cb(info)
    ipcRenderer.on('update-progress', handler)
    return () => ipcRenderer.removeListener('update-progress', handler)
  },
  onUpdateError: (cb: (message: string) => void): (() => void) => {
    const handler = (_: unknown, message: string): void => cb(message)
    ipcRenderer.on('update-error', handler)
    return () => ipcRenderer.removeListener('update-error', handler)
  },
  onAuthCallback: (
    cb: (payload: { code?: string; accessToken?: string; refreshToken?: string }) => void
  ): (() => void) => {
    const handler = (
      _: unknown,
      payload: { code?: string; accessToken?: string; refreshToken?: string }
    ): void => cb(payload)
    ipcRenderer.on('auth-callback', handler)
    return () => ipcRenderer.removeListener('auth-callback', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
