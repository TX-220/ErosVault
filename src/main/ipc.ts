import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { buildRsyncArgs, validatePaths, parseLine, parseStats, trackFilename } from '../utils/rsync'
import { setSchedule } from './scheduler'
import type { RsyncConfig, BackupRecord, RsyncResult } from '../renderer/lib/types'

const HISTORY_DIR = path.join(os.homedir(), '.backup-app')
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json')

function ensureHistoryDir(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true })
  }
}

function readHistory(): BackupRecord[] {
  ensureHistoryDir()
  if (!fs.existsSync(HISTORY_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as BackupRecord[]
  } catch {
    return []
  }
}

function appendHistory(record: BackupRecord): void {
  ensureHistoryDir()
  const history = readHistory()
  history.unshift(record) // newest first
  const trimmed = history.slice(0, 500) // cap at 500 records
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8')
}

const activeProcesses = new Map<string, ChildProcess>()

ipcMain.handle('backup:execute', async (event, config: RsyncConfig): Promise<RsyncResult> => {
  const startTime = Date.now()
  const sender = event.sender

  // 1. Validate paths
  sender.send('backup:progress', {
    status: 'validating',
    message: 'Checking source and destination paths...',
  })
  const validation = validatePaths(config.sourceDir, config.destDir)
  if (!validation.valid) {
    const result: RsyncResult = {
      status: 'error',
      message: validation.errors.join('; '),
      timestamp: new Date().toISOString(),
      filesChanged: 0,
      bytesTransferred: 0,
      duration: Date.now() - startTime,
    }
    return result
  }

  // 2. Build args and spawn
  const args = buildRsyncArgs(config)
  sender.send('backup:progress', {
    status: 'validating',
    message: `Starting rsync...`,
  })

  return new Promise<RsyncResult>((resolve) => {
    const proc = spawn('rsync', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    activeProcesses.set(config.backupName, proc)

    let stdoutBuffer = ''
    let stderrBuffer = ''
    let lastFilename: string | null = null

    proc.stdout!.setEncoding('utf-8')
    proc.stdout!.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Track current filename
        const filename = trackFilename(line)
        if (filename) {
          lastFilename = filename
        }

        const progress = parseLine(line, lastFilename)
        if (progress && !sender.isDestroyed()) {
          sender.send('backup:progress', progress)
        }
      }
    })

    proc.stderr!.setEncoding('utf-8')
    proc.stderr!.on('data', (chunk: string) => {
      stderrBuffer += chunk
    })

    proc.on('close', (exitCode) => {
      activeProcesses.delete(config.backupName)
      const duration = Date.now() - startTime
      const timestamp = new Date().toISOString()

      const fullOutput = stdoutBuffer + '\n' + stderrBuffer

      if (exitCode === 0) {
        const stats = parseStats(fullOutput)
        const result: RsyncResult = {
          status: 'complete',
          message: 'Backup completed successfully',
          timestamp,
          filesChanged: stats.filesChanged,
          bytesTransferred: stats.bytesTransferred,
          duration,
        }
        const record: BackupRecord = {
          ...result,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          backupName: config.backupName,
          sourceDir: config.sourceDir,
          destDir: config.destDir,
        }
        appendHistory(record)
        resolve(result)
      } else {
        const result: RsyncResult = {
          status: 'error',
          message: stderrBuffer.trim() || `rsync exited with code ${exitCode}`,
          timestamp,
          filesChanged: 0,
          bytesTransferred: 0,
          duration,
        }
        appendHistory({
          ...result,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          backupName: config.backupName,
          sourceDir: config.sourceDir,
          destDir: config.destDir,
        })
        resolve(result)
      }
    })

    proc.on('error', (err) => {
      activeProcesses.delete(config.backupName)
      const message = err.message.includes('ENOENT')
        ? 'rsync is not installed or not found in PATH'
        : err.message
      resolve({
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
        filesChanged: 0,
        bytesTransferred: 0,
        duration: Date.now() - startTime,
      })
    })
  })
})

ipcMain.handle(
  'backup:validate-paths',
  async (
    _event,
    { sourceDir, destDir }: { sourceDir: string; destDir: string }
  ) => {
    return validatePaths(sourceDir, destDir)
  }
)

ipcMain.handle('backup:get-history', async (): Promise<BackupRecord[]> => {
  return readHistory()
})

ipcMain.handle('backup:cancel', async (_event, backupName: string): Promise<{ success: boolean }> => {
  const proc = activeProcesses.get(backupName)
  if (proc) {
    proc.kill('SIGTERM')
    activeProcesses.delete(backupName)
    return { success: true }
  }
  return { success: false }
})

ipcMain.handle(
  'backup:schedule',
  async (
    _event,
    req: { enabled: boolean; cronExpression: string; backupConfig: RsyncConfig }
  ) => {
    return setSchedule(req)
  }
)

export function registerIpcHandlers(): void {
  // All handlers registered above at module evaluation time
}
