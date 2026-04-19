import { ipcMain, BrowserWindow, app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { buildRsyncArgs, validatePaths, parseLine, parseStats, trackFilename } from '../utils/rsync'
import { setSchedule, getSchedules, updateSchedule, deleteSchedule } from './scheduler'
import type { RsyncConfig, BackupRecord, RsyncResult, ScheduleRecord } from '../renderer/lib/types'

const HISTORY_DIR = path.join(os.homedir(), '.backup-app')
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json')

/**
 * Security check: Verify we're in the Electron main process
 * IPC handlers should only execute in main process context
 */
function verifyMainProcess(handlerName: string): void {
  const processType = process.type
  if (processType !== 'browser') {
    console.error(`[SECURITY] IPC handler "${handlerName}" called from ${processType} process (expected: browser)`)
    throw new Error('Backup operations are only available in the desktop application. Please use the Electron app, not the browser.')
  }
  console.log(`[IPC] Handler "${handlerName}" verified in main process`)
}

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

  // Security: Verify main process context
  try {
    verifyMainProcess('backup:execute')
  } catch (err) {
    console.error('[SECURITY] backup:execute rejected:', err instanceof Error ? err.message : String(err))
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Security error: IPC call from invalid context',
      timestamp: new Date().toISOString(),
      filesChanged: 0,
      bytesTransferred: 0,
      duration: 0,
    }
  }

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
    console.error(`[Backup ${config.backupName}] Validation failed:`, validation.errors)
    return result
  }

  // 2. Build args and spawn
  const args = buildRsyncArgs(config)
  const rsyncCommand = `rsync ${args.join(' ')}`
  console.log(`[Backup ${config.backupName}] Starting rsync:`, rsyncCommand)
  sender.send('backup:progress', {
    status: 'validating',
    message: `Starting rsync with ${args.length} arguments...`,
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
      console.log(`[Backup ${config.backupName}] rsync exited with code ${exitCode} after ${duration}ms`)

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
        const errorMsg = stderrBuffer.trim() || `rsync exited with code ${exitCode}`
        console.error(`[Backup ${config.backupName}] rsync failed:`, errorMsg)
        const result: RsyncResult = {
          status: 'error',
          message: errorMsg,
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
    verifyMainProcess('backup:validate-paths')
    return validatePaths(sourceDir, destDir)
  }
)

ipcMain.handle('backup:get-history', async (): Promise<BackupRecord[]> => {
  verifyMainProcess('backup:get-history')
  return readHistory()
})

ipcMain.handle('backup:cancel', async (_event, backupName: string): Promise<{ success: boolean }> => {
  verifyMainProcess('backup:cancel')
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
    verifyMainProcess('backup:schedule')
    return setSchedule(req)
  }
)

ipcMain.handle('backup:get-schedules', async (): Promise<ScheduleRecord[]> => {
  verifyMainProcess('backup:get-schedules')
  return getSchedules()
})

ipcMain.handle(
  'backup:update-schedule',
  async (
    _event,
    {
      id,
      updates,
    }: {
      id: string
      updates: Partial<Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'frequency' | 'time' | 'dayOfWeek'>>
    }
  ): Promise<ScheduleRecord | null> => {
    verifyMainProcess('backup:update-schedule')
    return updateSchedule(id, updates)
  }
)

ipcMain.handle(
  'backup:delete-schedule',
  async (_event, id: string): Promise<{ success: boolean }> => {
    verifyMainProcess('backup:delete-schedule')
    const ok = deleteSchedule(id)
    return { success: ok }
  }
)

export function registerIpcHandlers(): void {
  // All handlers registered above at module evaluation time
}
