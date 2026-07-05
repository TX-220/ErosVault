import { app, BrowserWindow } from 'electron'
import path from 'path'
import serve from 'electron-serve'
import { registerIpcHandlers } from './ipc'
import { stopAllSchedules, restoreSchedulesOnStartup } from './scheduler'

const isDev = !app.isPackaged

// Linux installs often lack setuid chrome-sandbox (4755). Without this, Electron aborts before our window opens.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

const loadURL = isDev ? undefined : serve({ directory: path.join(__dirname, '../out') })

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Linux dev boxes often lack setuid chrome-sandbox (mode 4755).
      // contextIsolation + preload still isolate the renderer.
      sandbox: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:3002')
    if (process.env.REPLICANT_DEVTOOLS === '1') {
      win.webContents.openDevTools()
    }
  } else {
    loadURL!(win)
  }

  return win
}

app.whenReady().then(() => {
  registerIpcHandlers()
  restoreSchedulesOnStartup()
  mainWindow = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopAllSchedules()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})