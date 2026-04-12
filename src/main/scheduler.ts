import cron, { ScheduledTask } from 'node-cron'
import { BrowserWindow } from 'electron'
import type { RsyncConfig } from '../renderer/lib/types'
import { validatePaths, buildRsyncArgs, parseLine, parseStats, trackFilename } from '../utils/rsync'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const HISTORY_DIR = path.join(os.homedir(), '.backup-app')
const HISTORY_FILE = path.join(HISTORY_DIR, 'history.json')

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
}

export interface ScheduleResponse {
  success: boolean
  message: string
}

export function setSchedule(req: ScheduleRequest): ScheduleResponse {
  const scheduleId = req.backupConfig.backupName

  // Stop existing schedule for this backup name
  const existing = activeTasks.get(scheduleId)
  if (existing) {
    existing.stop()
    activeTasks.delete(scheduleId)
  }

  if (!req.enabled) {
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
  return {
    success: true,
    message: `Schedule for "${scheduleId}" enabled: ${req.cronExpression}`,
  }
}

export function stopAllSchedules(): void {
  for (const task of activeTasks.values()) {
    task.stop()
  }
  activeTasks.clear()
}

async function runScheduledBackup(config: RsyncConfig): Promise<void> {
  const startTime = Date.now()

  // Validate first — scheduled backups may fire when USB is unmounted
  const validation = validatePaths(config.sourceDir, config.destDir)
  if (!validation.valid) {
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
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        backupName: config.backupName,
        sourceDir: config.sourceDir,
        destDir: config.destDir,
        status: 'error',
        message: err.message.includes('ENOENT')
          ? 'rsync is not installed or not found in PATH'
          : err.message,
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
