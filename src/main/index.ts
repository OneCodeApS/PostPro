import { app, shell, BrowserWindow, ipcMain, screen, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const PROTOCOL = 'postpro'

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    width: Math.round(width * 0.7),
    height: Math.round(height * 0.7),
    show: false,
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function handleAuthCallback(url: string): void {
  const parsed = new URL(url)
  const params = parsed.hash
    ? new URLSearchParams(parsed.hash.substring(1))
    : parsed.searchParams

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (accessToken && mainWindow) {
    mainWindow.webContents.send('auth-callback', { accessToken, refreshToken })
    mainWindow.focus()
  }
}

app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`))
  if (url) handleAuthCallback(url)
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('open-url', (_event, url) => {
  handleAuthCallback(url)
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('open-external', (_event, url: string) => shell.openExternal(url))

  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window-close', () => mainWindow?.close())

  ipcMain.handle(
    'http-request',
    async (
      _event,
      opts: { url: string; method: string; headers: Record<string, string>; body?: string }
    ) => {
      const start = Date.now()
      try {
        const res = await net.fetch(opts.url, {
          method: opts.method,
          headers: opts.headers,
          body: opts.body ?? undefined
        })
        const body = await res.text()
        const headers: Record<string, string> = {}
        res.headers.forEach((val, key) => {
          headers[key] = val
        })
        return {
          status: res.status,
          statusText: res.statusText,
          headers,
          body,
          time: Date.now() - start
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'Request failed' }
      }
    }
  )

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
