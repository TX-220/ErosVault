import cron, { ScheduledTask } from 'node-cron'
import { CronExpressionParser } from 'cron-parser'
import { BrowserWindow } from 'electron'
import type { RsyncConfig, ScheduleRecord } from '../renderer/lib/types'
import { validatePaths, buildRsyncArgs, parseLine, parseStats, trackFilename } from '../utils/rsync'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const HISTORY_DIR = path.join(os.homedir(), '.backup-app')
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json')
const SCHEDULES_FILE = path.join(HISTORY_DIR, 'schedules.json')

function readSchedules(): ScheduleRecord[] {
  if (!fs.existsSync(SCHEDULES_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8')) as ScheduleRecord[]
  } catch {
    return []
  }
}

function writeSchedules(schedules: ScheduleRecord[]): void {
  ensureHistoryDir()
  fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf-8')
}

function getNextRun(cronExpression: string): string | undefined {
  try {
    const interval = CronExpressionParser.parse(cronExpression)
    return interval.next().toDate().toISOString()
  } catch {
    return undefined
  }
}

function ensureHistoryDir(): void {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true })
  }
}

function appendHistory(record: object): void {
  ensureHistoryDir()
  let history: object[] = []
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
    } catch {
      history = []
    }
  }
  history.unshift(record)
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf-8')
}

// Map of scheduleId → cron task (allows stopping individual schedules)
const activeTasks = new Map<string, ScheduledTask>()

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

  // Stop existing cron task for this backup name
  const existing = activeTasks.get(scheduleId)
  if (existing) {
    existing.stop()
    activeTasks.delete(scheduleId)
  }

  const schedules = readSchedules()
  const existingRecord = schedules.find((s) => s.backupName === scheduleId)

  if (!req.enabled) {
    // Update persisted record to disabled if it exists
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

  const task = cron.schedule(req.cronExpression, () => {
    runScheduledBackup(req.backupConfig)
  })
  activeTasks.set(scheduleId, task)

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
  updates: Partial<Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'frequency' | 'time' | 'dayOfWeek'>>
): ScheduleRecord | null {
  const schedules = readSchedules()
  const idx = schedules.findIndex((s) => s.id === id)
  if (idx === -1) return null

  const existing = schedules[idx]

  // If toggling enabled state or changing cron expression, restart cron task
  const cronExpr = updates.cronExpression ?? existing.cronExpression
  const enabled = updates.enabled ?? existing.enabled

  const old = activeTasks.get(existing.backupName)
  if (old) {
    old.stop()
    activeTasks.delete(existing.backupName)
  }

  let nextRun: string | undefined
  if (enabled) {
    if (!cron.validate(cronExpr)) return null
    const task = cron.schedule(cronExpr, () => {
      runScheduledBackup(existing.backupConfig)
    })
    activeTasks.set(existing.backupName, task)
    nextRun = getNextRun(cronExpr)
  }

  const updated: ScheduleRecord = {
    ...existing,
    ...updates,
    cronExpression: cronExpr,
    enabled,
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

async function runScheduledBackup(config: RsyncConfig): Promise<void> {
  const startTime = Date.now()
  console.log(`[Scheduled Backup ${config.backupName}] Started`)

  // Validate first — scheduled backups may fire when USB is unmounted
  const validation = validatePaths(config.sourceDir, config.destDir)
  if (!validation.valid) {
    console.error(`[Scheduled Backup ${config.backupName}] Validation failed:`, validation.errors)
    appendHistory({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      backupName: config.backupName,
      sourceDir: config.sourceDir,
      destDir: config.destDir,
      status: 'error',
      message: validation.errors.join('; '),
      timestamp: new Date().toISOString(),
      filesChanged: 0,
      bytesTransferred: 0,
      duration: Date.now() - startTime,
    })
    notifyRenderer('backup:scheduled-result', {
      backupName: config.backupName,
      status: 'error',
      message: validation.errors.join('; '),
    })
    return
  }

  const args = buildRsyncArgs(config)
  const rsyncCommand = `rsync ${args.join(' ')}`
  console.log(`[Scheduled Backup ${config.backupName}] Running: ${rsyncCommand}`)

  return new Promise<void>((resolve) => {
    const proc = spawn('rsync', args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdoutBuffer = ''
    let stderrBuffer = ''
    let lastFilename: string | null = null

    proc.stdout!.setEncoding('utf-8')
    proc.stdout!.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const filename = trackFilename(line)
        if (filename) lastFilename = filename
        const progress = parseLine(line, lastFilename)
        if (progress) {
          notifyRenderer('backup:progress', { ...progress, scheduled: true })
        }
      }
    })

    proc.stderr!.setEncoding('utf-8')
    proc.stderr!.on('data', (chunk: string) => {
      stderrBuffer += chunk
    })

    proc.on('close', (exitCode) => {
      const duration = Date.now() - startTime
      const timestamp = new Date().toISOString()
      const fullOutput = stdoutBuffer + '\n' + stderrBuffer
      const runStatus: 'complete' | 'error' = exitCode === 0 ? 'complete' : 'error'

      console.log(`[Scheduled Backup ${config.backupName}] rsync exited with code ${exitCode} after ${duration}ms`)

      // Update schedule record with lastRun / lastStatus / nextRun
      const schedules = readSchedules()
      const schedIdx = schedules.findIndex((s) => s.backupName === config.backupName)
      if (schedIdx !== -1) {
        schedules[schedIdx] = {
          ...schedules[schedIdx],
          lastRun: timestamp,
          lastStatus: runStatus,
          nextRun: getNextRun(schedules[schedIdx].cronExpression),
        }
        writeSchedules(schedules)
      }

      if (exitCode === 0) {
        const stats = parseStats(fullOutput)
        const record = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          backupName: config.backupName,
          sourceDir: config.sourceDir,
          destDir: config.destDir,
          status: 'complete',
          message: 'Scheduled backup completed successfully',
          timestamp,
          filesChanged: stats.filesChanged,
          bytesTransferred: stats.bytesTransferred,
          duration,
        }
        appendHistory(record)
        notifyRenderer('backup:scheduled-result', {
          backupName: config.backupName,
          status: 'complete',
          filesChanged: stats.filesChanged,
        })
      } else {
        const record = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          backupName: config.backupName,
          sourceDir: config.sourceDir,
          destDir: config.destDir,
          status: 'error',
          message: stderrBuffer.trim() || `rsync exited with code ${exitCode}`,
          timestamp,
          filesChanged: 0,
          bytesTransferred: 0,
          duration,
        }
        appendHistory(record)
        notifyRenderer('backup:scheduled-result', {
          backupName: config.backupName,
          status: 'error',
          message: record.message,
        })
      }
      resolve()
    })

    proc.on('error', (err) => {
      const errorMsg = err.message.includes('ENOENT')
        ? 'rsync is not installed or not found in PATH'
        : err.message
      console.error(`[Scheduled Backup ${config.backupName}] rsync error:`, errorMsg)
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        backupName: config.backupName,
        sourceDir: config.sourceDir,
        destDir: config.destDir,
        status: 'error',
        message: errorMsg,
        timestamp: new Date().toISOString(),
        filesChanged: 0,
        bytesTransferred: 0,
        duration: Date.now() - startTime,
      }
      appendHistory(record)
      resolve()
    })
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
