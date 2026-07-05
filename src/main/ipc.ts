import { ipcMain } from 'electron'
import { ChildProcess } from 'child_process'
import type { RsyncConfig, BackupRecord, RsyncResult, ScheduleRecord } from '../renderer/lib/types'
import { validatePaths } from '../utils/rsync'
import { validateRsyncConfig } from '../shared/validation'
import { setSchedule, getSchedules, updateSchedule, deleteSchedule } from './scheduler'
import { appendHistory, readHistory, readConfig, writeConfig } from './persistence'
import { tryAcquireRun, releaseRun } from './run-registry'
import { spawnRsyncProcess, attachRsyncListeners } from './rsync-process'

const activeProcesses = new Map<string, ChildProcess>()
const cancelRequested = new Set<string>()

const CANCEL_GRACE_MS = 3000

function rejectInvalidConfig(config: unknown): RsyncResult | null {
  const validation = validateRsyncConfig(config)
  if (!validation.valid) {
    return {
      status: 'error',
      message: validation.errors.join('; '),
      timestamp: new Date().toISOString(),
      filesChanged: 0,
      bytesTransferred: 0,
      duration: 0,
    }
  }
  return null
}

ipcMain.handle('backup:execute', async (event, config: RsyncConfig): Promise<RsyncResult> => {
  const startTime = Date.now()
  const sender = event.sender

  const configError = rejectInvalidConfig(config)
  if (configError) return configError

  if (!tryAcquireRun(config.backupName, 'manual')) {
    return {
      status: 'error',
      message: `Backup "${config.backupName}" is already running`,
      timestamp: new Date().toISOString(),
      filesChanged: 0,
      bytesTransferred: 0,
      duration: 0,
    }
  }

  sender.send('backup:progress', {
    status: 'validating',
    message: 'Checking source and destination paths...',
  })

  const validation = validatePaths(config.sourceDir, config.destDir)
  if (!validation.valid) {
    releaseRun(config.backupName)
    return {
      status: 'error',
      message: validation.errors.join('; '),
      timestamp: new Date().toISOString(),
      filesChanged: 0,
      bytesTransferred: 0,
      duration: Date.now() - startTime,
    }
  }

  console.log(`[Backup ${config.backupName}] Starting rsync`)
  sender.send('backup:progress', {
    status: 'validating',
    message: 'Starting rsync...',
  })

  const proc = spawnRsyncProcess({
    config,
    onProgress: (progress) => {
      if (!sender.isDestroyed()) sender.send('backup:progress', progress)
    },
    isCancelled: () => cancelRequested.has(config.backupName),
  })
  activeProcesses.set(config.backupName, proc)

  try {
    const result = await attachRsyncListeners(proc, {
      config,
      onProgress: (progress) => {
        if (!sender.isDestroyed()) sender.send('backup:progress', progress)
      },
      isCancelled: () => cancelRequested.has(config.backupName),
    })

    const duration = Date.now() - startTime
    const timestamp = new Date().toISOString()

    if (result.exitCode === null && result.stderr.includes('rsync is not installed')) {
      return {
        status: 'error',
        message: result.stderr,
        timestamp,
        filesChanged: 0,
        bytesTransferred: 0,
        duration,
      }
    }

    if (result.cancelled || cancelRequested.has(config.backupName)) {
      if (!sender.isDestroyed()) {
        sender.send('backup:progress', { status: 'cancelled', message: 'Backup cancelled' })
      }
      return {
        status: 'cancelled',
        message: 'Backup cancelled',
        timestamp,
        filesChanged: 0,
        bytesTransferred: 0,
        duration,
      }
    }

    if (result.exitCode === 0) {
      const rsyncResult: RsyncResult = {
        status: 'complete',
        message: 'Backup completed successfully',
        timestamp,
        filesChanged: result.stats.filesChanged,
        bytesTransferred: result.stats.bytesTransferred,
        duration,
      }
      const record: BackupRecord = {
        ...rsyncResult,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        backupName: config.backupName,
        sourceDir: config.sourceDir,
        destDir: config.destDir,
      }
      await appendHistory(record)
      return rsyncResult
    }

    const errorMsg = result.stderr.trim() || `rsync exited with code ${result.exitCode}`
    const rsyncResult: RsyncResult = {
      status: 'error',
      message: errorMsg,
      timestamp,
      filesChanged: 0,
      bytesTransferred: 0,
      duration,
    }
    await appendHistory({
      ...rsyncResult,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      backupName: config.backupName,
      sourceDir: config.sourceDir,
      destDir: config.destDir,
    })
    return rsyncResult
  } finally {
    activeProcesses.delete(config.backupName)
    cancelRequested.delete(config.backupName)
    releaseRun(config.backupName)
  }
})

ipcMain.handle(
  'backup:validate-paths',
  async (_event, { sourceDir, destDir }: { sourceDir: string; destDir: string }) => {
    const configCheck = validateRsyncConfig({
      backupName: 'validate',
      sourceDir,
      destDir,
    })
    if (!configCheck.valid) return configCheck
    return validatePaths(sourceDir, destDir)
  }
)

ipcMain.handle('backup:get-history', async (): Promise<BackupRecord[]> => {
  return readHistory()
})

ipcMain.handle('backup:get-config', async (): Promise<RsyncConfig | null> => {
  return readConfig()
})

ipcMain.handle('backup:save-config', async (_event, config: RsyncConfig): Promise<{ success: boolean; message?: string }> => {
  const validation = validateRsyncConfig(config)
  if (!validation.valid) {
    return { success: false, message: validation.errors.join('; ') }
  }
  await writeConfig(config)
  return { success: true }
})

ipcMain.handle('backup:cancel', async (event, backupName: string): Promise<{ success: boolean }> => {
  const proc = activeProcesses.get(backupName)
  if (!proc) return { success: false }

  cancelRequested.add(backupName)
  proc.kill('SIGTERM')

  setTimeout(() => {
    if (!proc.killed) {
      proc.kill('SIGKILL')
    }
  }, CANCEL_GRACE_MS)

  event.sender.send('backup:progress', { status: 'cancelled', message: 'Cancelling backup...' })
  return { success: true }
})

ipcMain.handle(
  'backup:schedule',
  async (
    _event,
    req: {
      enabled: boolean
      cronExpression: string
      backupConfig: RsyncConfig
      frequency?: ScheduleRecord['frequency']
      time?: string
      dayOfWeek?: number
    }
  ) => {
    const configError = rejectInvalidConfig(req.backupConfig)
    if (configError) {
      return { success: false, message: configError.message }
    }
    return setSchedule(req)
  }
)

ipcMain.handle('backup:get-schedules', async (): Promise<ScheduleRecord[]> => {
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
      updates: Partial<
        Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'frequency' | 'time' | 'dayOfWeek' | 'backupConfig'>
      >
    }
  ): Promise<ScheduleRecord | null> => {
    if (updates.backupConfig) {
      const configError = rejectInvalidConfig(updates.backupConfig)
      if (configError) return null
    }
    return updateSchedule(id, updates)
  }
)

ipcMain.handle('backup:delete-schedule', async (_event, id: string): Promise<{ success: boolean }> => {
  const ok = deleteSchedule(id)
  return { success: ok }
})

export function registerIpcHandlers(): void {
  // Handlers registered at module evaluation time
}