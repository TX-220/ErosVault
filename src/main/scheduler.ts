import cron, { ScheduledTask } from 'node-cron'
import { CronExpressionParser } from 'cron-parser'
import { BrowserWindow } from 'electron'
import type { RsyncConfig, ScheduleRecord } from '../renderer/lib/types'
import { validatePaths } from '../utils/rsync'
import {
  appendHistory,
  readSchedulesFile,
  writeSchedulesFile,
  writeSchedulesFileSync,
} from './persistence'
import { tryAcquireRun, releaseRun } from './run-registry'
import { spawnRsyncProcess, attachRsyncListeners } from './rsync-process'

const activeTasks = new Map<string, ScheduledTask>()

function readSchedules(): ScheduleRecord[] {
  return readSchedulesFile<ScheduleRecord>()
}

function writeSchedules(schedules: ScheduleRecord[]): void {
  writeSchedulesFileSync(schedules)
}

function getNextRun(cronExpression: string): string | undefined {
  try {
    const interval = CronExpressionParser.parse(cronExpression)
    return interval.next().toDate().toISOString()
  } catch {
    return undefined
  }
}

function registerCronTask(backupName: string, cronExpression: string, backupConfig: RsyncConfig): void {
  const existing = activeTasks.get(backupName)
  if (existing) {
    existing.stop()
    activeTasks.delete(backupName)
  }

  const task = cron.schedule(cronExpression, () => {
    void runScheduledBackup(backupConfig)
  })
  activeTasks.set(backupName, task)
}

export function restoreSchedulesOnStartup(): void {
  const schedules = readSchedules()
  for (const record of schedules) {
    if (record.enabled && cron.validate(record.cronExpression)) {
      registerCronTask(record.backupName, record.cronExpression, record.backupConfig)
      console.log(`[scheduler] Restored schedule for "${record.backupName}": ${record.cronExpression}`)
    }
  }
}

export interface ScheduleRequest {
  enabled: boolean
  cronExpression: string
  backupConfig: RsyncConfig
  frequency?: import('../renderer/lib/types').ScheduleFrequency
  time?: string
  dayOfWeek?: number
}

export interface ScheduleResponse {
  success: boolean
  message: string
  schedule?: ScheduleRecord
}

export function setSchedule(req: ScheduleRequest): ScheduleResponse {
  const scheduleId = req.backupConfig.backupName

  const existing = activeTasks.get(scheduleId)
  if (existing) {
    existing.stop()
    activeTasks.delete(scheduleId)
  }

  const schedules = readSchedules()
  const existingRecord = schedules.find((s) => s.backupName === scheduleId)

  if (!req.enabled) {
    if (existingRecord) {
      const updated = schedules.map((s) =>
        s.backupName === scheduleId ? { ...s, enabled: false, nextRun: undefined } : s
      )
      writeSchedules(updated)
      return {
        success: true,
        message: `Schedule for "${scheduleId}" disabled.`,
        schedule: updated.find((s) => s.backupName === scheduleId),
      }
    }
    return { success: true, message: `Schedule for "${scheduleId}" disabled.` }
  }

  if (!cron.validate(req.cronExpression)) {
    return {
      success: false,
      message: `Invalid cron expression: "${req.cronExpression}"`,
    }
  }

  registerCronTask(scheduleId, req.cronExpression, req.backupConfig)

  const nextRun = getNextRun(req.cronExpression)
  const now = new Date().toISOString()

  let record: ScheduleRecord
  if (existingRecord) {
    record = {
      ...existingRecord,
      cronExpression: req.cronExpression,
      enabled: true,
      frequency: req.frequency ?? existingRecord.frequency,
      time: req.time ?? existingRecord.time,
      dayOfWeek: req.dayOfWeek ?? existingRecord.dayOfWeek,
      backupConfig: req.backupConfig,
      nextRun,
    }
    writeSchedules(schedules.map((s) => (s.id === record.id ? record : s)))
  } else {
    record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      backupName: scheduleId,
      cronExpression: req.cronExpression,
      enabled: true,
      frequency: req.frequency ?? 'custom',
      time: req.time ?? '00:00',
      dayOfWeek: req.dayOfWeek ?? 0,
      backupConfig: req.backupConfig,
      createdAt: now,
      nextRun,
    }
    writeSchedules([...schedules, record])
  }

  return {
    success: true,
    message: `Schedule for "${scheduleId}" enabled: ${req.cronExpression}`,
    schedule: record,
  }
}

export function getSchedules(): ScheduleRecord[] {
  return readSchedules()
}

export function updateSchedule(
  id: string,
  updates: Partial<
    Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'frequency' | 'time' | 'dayOfWeek' | 'backupConfig'>
  >
): ScheduleRecord | null {
  const schedules = readSchedules()
  const idx = schedules.findIndex((s) => s.id === id)
  if (idx === -1) return null

  const existing = schedules[idx]
  const cronExpr = updates.cronExpression ?? existing.cronExpression
  const enabled = updates.enabled ?? existing.enabled
  const backupConfig = updates.backupConfig ?? existing.backupConfig

  const old = activeTasks.get(existing.backupName)
  if (old) {
    old.stop()
    activeTasks.delete(existing.backupName)
  }

  let nextRun: string | undefined
  if (enabled) {
    if (!cron.validate(cronExpr)) return null
    registerCronTask(existing.backupName, cronExpr, backupConfig)
    nextRun = getNextRun(cronExpr)
  }

  const updated: ScheduleRecord = {
    ...existing,
    ...updates,
    cronExpression: cronExpr,
    enabled,
    backupConfig,
    nextRun,
  }
  schedules[idx] = updated
  writeSchedules(schedules)
  return updated
}

export function deleteSchedule(id: string): boolean {
  const schedules = readSchedules()
  const record = schedules.find((s) => s.id === id)
  if (!record) return false

  const task = activeTasks.get(record.backupName)
  if (task) {
    task.stop()
    activeTasks.delete(record.backupName)
  }

  writeSchedules(schedules.filter((s) => s.id !== id))
  return true
}

export function stopAllSchedules(): void {
  for (const task of activeTasks.values()) {
    task.stop()
  }
  activeTasks.clear()
}

async function updateScheduleAfterRun(
  backupName: string,
  timestamp: string,
  runStatus: 'complete' | 'error'
): Promise<void> {
  const schedules = readSchedules()
  const schedIdx = schedules.findIndex((s) => s.backupName === backupName)
  if (schedIdx === -1) return

  schedules[schedIdx] = {
    ...schedules[schedIdx],
    lastRun: timestamp,
    lastStatus: runStatus,
    nextRun: getNextRun(schedules[schedIdx].cronExpression),
  }
  await writeSchedulesFile(schedules)
}

async function runScheduledBackup(config: RsyncConfig): Promise<void> {
  const startTime = Date.now()
  console.log(`[Scheduled Backup ${config.backupName}] Started`)

  if (!tryAcquireRun(config.backupName, 'scheduled')) {
    console.warn(`[Scheduled Backup ${config.backupName}] Skipped — backup already running`)
    return
  }

  try {
    const validation = validatePaths(config.sourceDir, config.destDir)
    if (!validation.valid) {
      const message = validation.errors.join('; ')
      console.error(`[Scheduled Backup ${config.backupName}] Validation failed:`, validation.errors)
      const timestamp = new Date().toISOString()
      await appendHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        backupName: config.backupName,
        sourceDir: config.sourceDir,
        destDir: config.destDir,
        status: 'error',
        message,
        timestamp,
        filesChanged: 0,
        bytesTransferred: 0,
        duration: Date.now() - startTime,
      })
      await updateScheduleAfterRun(config.backupName, timestamp, 'error')
      notifyRenderer('backup:scheduled-result', {
        backupName: config.backupName,
        status: 'error',
        message,
      })
      return
    }

    const proc = spawnRsyncProcess({
      config,
      onProgress: (progress) => {
        notifyRenderer('backup:progress', { ...progress, scheduled: true })
      },
    })

    const result = await attachRsyncListeners(proc, { config })
    const duration = Date.now() - startTime
    const timestamp = new Date().toISOString()

    if (result.exitCode === null && result.stderr.includes('rsync is not installed')) {
      await handleScheduledError(config, result.stderr, startTime, timestamp)
      return
    }

    const runStatus: 'complete' | 'error' = result.exitCode === 0 ? 'complete' : 'error'
    await updateScheduleAfterRun(config.backupName, timestamp, runStatus)

    if (result.exitCode === 0) {
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        backupName: config.backupName,
        sourceDir: config.sourceDir,
        destDir: config.destDir,
        status: 'complete' as const,
        message: 'Scheduled backup completed successfully',
        timestamp,
        filesChanged: result.stats.filesChanged,
        bytesTransferred: result.stats.bytesTransferred,
        duration,
      }
      await appendHistory(record)
      notifyRenderer('backup:scheduled-result', {
        backupName: config.backupName,
        status: 'complete',
        filesChanged: result.stats.filesChanged,
      })
    } else {
      const message = result.stderr.trim() || `rsync exited with code ${result.exitCode}`
      await handleScheduledError(config, message, startTime, timestamp)
    }
  } finally {
    releaseRun(config.backupName)
  }
}

async function handleScheduledError(
  config: RsyncConfig,
  message: string,
  startTime: number,
  timestamp: string
): Promise<void> {
  console.error(`[Scheduled Backup ${config.backupName}] Error:`, message)
  await appendHistory({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    backupName: config.backupName,
    sourceDir: config.sourceDir,
    destDir: config.destDir,
    status: 'error',
    message,
    timestamp,
    filesChanged: 0,
    bytesTransferred: 0,
    duration: Date.now() - startTime,
  })
  await updateScheduleAfterRun(config.backupName, timestamp, 'error')
  notifyRenderer('backup:scheduled-result', {
    backupName: config.backupName,
    status: 'error',
    message,
  })
}

function notifyRenderer(channel: string, data: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}