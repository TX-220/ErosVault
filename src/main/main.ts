import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import serve from 'electron-serve'
import { registerIpcHandlers } from './ipc'
import { stopAllSchedules, restoreSchedulesOnStartup } from './scheduler'

/**
 * Dev server only when explicitly requested (pnpm dev sets EROSVAULT_DEV=1).
 * Plain `electron .` / packaged builds must load static export from `out/`.
 * (Previously !app.isPackaged always hit localhost:3002 → black empty window.)
 */
const useDevServer =
  process.env.EROSVAULT_DEV === '1' || process.env.REPLICANT_DEV === '1'

// Linux installs often lack setuid chrome-sandbox (4755). Without this, Electron aborts before our window opens.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}
// Windows guest / some VMs: same flag via CLI; harmless if already set.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('no-sandbox')
}

/**
 * Next.js `output: 'export'` → project-root `out/` (NOT dist-electron/out).
 * main.js lives at dist-electron/main/ → ../../out
 *
 * electron-serve MUST be constructed before app.ready (registers privileged scheme).
 */
function resolveOutDir(): string {
  const candidates = [
    path.join(__dirname, '..', '..', 'out'),
    path.join(process.cwd(), 'out'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir
    }
  }
  return candidates[0]
}

const outDir = resolveOutDir()
// Call serve() at module load — before app.whenReady() — or electron-serve throws:
// "protocol.registerSchemesAsPrivileged should be called before app is ready"
const loadStatic = useDevServer
  ? null
  : serve({ directory: outDir })

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'ErosVault',
    backgroundColor: '#0a0612',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Linux dev boxes often lack setuid chrome-sandbox (mode 4755).
      // contextIsolation + preload still isolate the renderer.
      sandbox: false,
    },
  })

  win.setTitle('ErosVault')

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[ErosVault] did-fail-load', { code, desc, url })
    if (process.env.EROSVAULT_DEVTOOLS === '1' || process.env.REPLICANT_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  })

  if (useDevServer) {
    void win.loadURL('http://localhost:3002')
    if (process.env.REPLICANT_DEVTOOLS === '1' || process.env.EROSVAULT_DEVTOOLS === '1') {
      win.webContents.openDevTools()
    }
  } else if (loadStatic) {
    console.log('[ErosVault] loading static UI from', outDir)
    void loadStatic(win)
  } else {
    // Fallback: load file:// if serve was skipped
    void win.loadFile(path.join(outDir, 'index.html'))
  }

  return win
}

app.whenReady().then(() => {
  app.setName('ErosVault')
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