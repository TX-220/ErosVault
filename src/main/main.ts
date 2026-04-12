import { app, BrowserWindow } from 'electron'
import path from 'path'
import serve from 'electron-serve'
import { registerIpcHandlers } from './ipc'
import { stopAllSchedules } from './scheduler'

const isDev = !app.isPackaged

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
      sandbox: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:3002')
    win.webContents.openDevTools()
  } else {
    loadURL!(win)
  }

  return win
}

app.whenReady().then(() => {
  registerIpcHandlers()
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
