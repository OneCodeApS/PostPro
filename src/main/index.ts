import { app, shell, BrowserWindow, ipcMain, screen, net } from 'electron'
import { join } from 'path'
import { createServer, type Server } from 'http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'

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

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)

    window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
      if (input.key === 'F5' || (input.control && input.key === 'r')) {
        window.webContents.reload()
        event.preventDefault()
      }
    })
  })

  ipcMain.handle('open-external', (_event, url: string) => shell.openExternal(url))

  ipcMain.handle('open-auth-window', async (_event, url: string) => {
    return await new Promise<{
      ok: boolean
      accessToken?: string
      refreshToken?: string
      error?: string
    }>((resolve) => {
      let resolved = false
      let server: Server | null = null

      // Start a local server on port 48372 that serves a page to read hash tokens
      server = createServer((req, res) => {
        const reqUrl = new URL(req.url ?? '/', 'http://localhost:48372')

        if (reqUrl.pathname === '/auth-callback') {
          // Serve a page that reads hash fragment and posts tokens back
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`<html><body><script>
            const p = new URLSearchParams(location.hash.substring(1));
            fetch('/auth-tokens', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({
                accessToken: p.get('access_token'),
                refreshToken: p.get('refresh_token'),
                error: p.get('error')
              })
            });
          </script></body></html>`)
        } else if (reqUrl.pathname === '/auth-tokens' && req.method === 'POST') {
          let body = ''
          req.on('data', (c) => {
            body += c
          })
          req.on('end', () => {
            res.writeHead(200)
            res.end()
            if (resolved) return
            resolved = true
            try {
              const { accessToken, refreshToken, error } = JSON.parse(body)
              if (error) {
                resolve({ ok: false, error })
              } else if (accessToken) {
                resolve({ ok: true, accessToken, refreshToken })
              } else {
                resolve({ ok: false, error: 'No tokens returned' })
              }
            } catch {
              resolve({ ok: false, error: 'Failed to parse tokens' })
            }
            authWindow.close()
            server?.close()
            server = null
          })
        } else {
          res.writeHead(404)
          res.end()
        }
      })
      server.listen(48372)

      const authWindow = new BrowserWindow({
        width: 520,
        height: 720,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      authWindow.on('closed', () => {
        if (!resolved) {
          resolved = true
          resolve({ ok: false, error: 'Auth window closed' })
        }
        server?.close()
        server = null
      })

      authWindow.loadURL(url)
    })
  })

  ipcMain.on('check-for-updates', () => autoUpdater.checkForUpdates())

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

  // Auto-updater
  autoUpdater.autoDownload = false
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Update check failed:', err)
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', {
      version: info.version
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', {
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err)
    mainWindow?.webContents.send('update-error', err.message ?? 'Unknown update error')
  })

  ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('get-app-version', () => app.getVersion())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
