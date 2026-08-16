/**
 * Headless schedule runner for ErosVault P0 backups.
 * Reads ~/.backup-app/schedules.json and runs enabled cron jobs without Electron GUI.
 * (Unit/binary name may still be replicant-scheduler for systemd compatibility.)
 */
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawnSync } from 'child_process'
import cron, { ScheduledTask } from 'node-cron'
import { CronExpressionParser } from 'cron-parser'
import type { RsyncConfig, ScheduleRecord } from '../renderer/lib/types'
import { validatePaths } from '../utils/rsync'
import {
  DATA_DIR,
  SCHEDULES_FILE,
  appendHistory,
  ensureDataDir,
  readSchedulesFile,
  writeSchedulesFile,
} from '../main/persistence'
import { tryAcquireRun, releaseRun } from '../main/run-registry'
import { spawnRsyncProcess, attachRsyncListeners } from '../main/rsync-process'

const PID_FILE = path.join(DATA_DIR, 'scheduler.pid')
const RELOAD_MS = 30_000
const HOME = os.homedir()
const KIOXIA_MOUNT = process.env.KIOXIA_MOUNT || '/mnt/kioxia'
const KIOXIA_UNLOCK = path.join(HOME, 'bin', 'kioxia-unlock')
const REFRESH_META = path.join(HOME, 'bin', 'replicant-p0-refresh-meta')
const REFRESH_HOST_OPS = path.join(HOME, 'bin', 'erosvault-refresh-host-ops')
const VM_GUEST_PULL = path.join(HOME, 'VMs', 'bin', 'fxgt-mt5-pull-staging')

const activeTasks = new Map<string, { task: ScheduledTask; fingerprint: string }>()
let reloadTimer: NodeJS.Timeout | null = null
let shuttingDown = false

function log(msg: string): void {
  // Keep legacy tag for journalctl greps; product name is ErosVault
  const line = `[replicant-scheduler ${new Date().toISOString()}] ${msg}`
  console.log(line)
}

function getNextRun(cronExpression: string): string | undefined {
  try {
    return CronExpressionParser.parse(cronExpression).next().toDate().toISOString()
  } catch {
    return undefined
  }
}

function fingerprint(record: ScheduleRecord): string {
  return JSON.stringify({
    e: record.enabled,
    c: record.cronExpression,
    s: record.backupConfig.sourceDir,
    d: record.backupConfig.destDir,
    x: record.backupConfig.excludePatterns ?? [],
  })
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function isDaemonRunning(): boolean {
  ensureDataDir()
  if (!fs.existsSync(PID_FILE)) return false
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10)
    if (!Number.isFinite(pid) || pid <= 0) return false
    return isPidAlive(pid)
  } catch {
    return false
  }
}

function writePidFile(): void {
  ensureDataDir()
  if (fs.existsSync(PID_FILE)) {
    const raw = fs.readFileSync(PID_FILE, 'utf-8').trim()
    const existing = parseInt(raw, 10)
    if (Number.isFinite(existing) && existing !== process.pid && isPidAlive(existing)) {
      throw new Error(`Another scheduler daemon is already running (pid ${existing})`)
    }
  }
  fs.writeFileSync(PID_FILE, `${process.pid}\n`, 'utf-8')
}

function removePidFile(): void {
  try {
    if (!fs.existsSync(PID_FILE)) return
    const raw = fs.readFileSync(PID_FILE, 'utf-8').trim()
    if (parseInt(raw, 10) === process.pid) {
      fs.unlinkSync(PID_FILE)
    }
  } catch {
    // ignore
  }
}

function ensureKioxiaIfNeeded(destDir: string): boolean {
  if (!destDir.startsWith(KIOXIA_MOUNT)) return true
  try {
    const st = fs.statSync(KIOXIA_MOUNT)
    if (st.isDirectory()) {
      // mountpoint check via /proc/mounts
      const mounts = fs.readFileSync('/proc/mounts', 'utf-8')
      if (mounts.split('\n').some((l) => l.split(' ')[1] === KIOXIA_MOUNT)) {
        return true
      }
    }
  } catch {
    // fall through to unlock
  }
  if (fs.existsSync(KIOXIA_UNLOCK) && fs.statSync(KIOXIA_UNLOCK).mode & 0o111) {
    log(`USB not mounted — running kioxia-unlock for dest ${destDir}`)
    const r = spawnSync(KIOXIA_UNLOCK, [], { encoding: 'utf-8', env: process.env })
    if (r.status !== 0) {
      log(`kioxia-unlock failed: ${(r.stderr || r.stdout || '').trim()}`)
      return false
    }
    return true
  }
  log(`FAIL: ${KIOXIA_MOUNT} not mounted and kioxia-unlock unavailable`)
  return false
}

function maybeRefreshHomeMeta(backupName: string): void {
  if (backupName !== 'p0-home-meta') return
  if (!fs.existsSync(REFRESH_META)) return
  log('Refreshing p0-home-meta staging tree')
  const r = spawnSync(REFRESH_META, [], { encoding: 'utf-8', env: process.env })
  if (r.status !== 0) {
    log(`refresh-meta failed (continuing): ${(r.stderr || r.stdout || '').trim()}`)
  }
}

/** Pull Windows guest TradeBot data into host staging before p0-vm-guest rsync. */
function maybePullVmGuest(backupName: string): void {
  if (backupName !== 'p0-vm-guest') return
  if (!fs.existsSync(VM_GUEST_PULL)) {
    log(`vm-guest pull script missing: ${VM_GUEST_PULL} (continuing with existing staging)`)
    return
  }
  log('Pulling fxgt-mt5 guest TradeBot → host staging')
  const r = spawnSync(VM_GUEST_PULL, [], {
    encoding: 'utf-8',
    env: process.env,
    timeout: 10 * 60 * 1000,
  })
  if (r.status !== 0) {
    log(
      `vm-guest pull failed (continuing with last staging): ${(r.stderr || r.stdout || '').trim()}`
    )
  } else {
    const out = (r.stdout || '').trim()
    if (out) log(out.split('\n').slice(-3).join(' | '))
  }
}

/** Refresh lightweight host-ops staging before p0-host-ops rsync. */
function maybeRefreshHostOps(backupName: string): void {
  if (backupName !== 'p0-host-ops') return
  if (!fs.existsSync(REFRESH_HOST_OPS)) {
    log(`host-ops refresh missing: ${REFRESH_HOST_OPS}`)
    return
  }
  log('Refreshing p0-host-ops staging tree')
  const r = spawnSync(REFRESH_HOST_OPS, [], { encoding: 'utf-8', env: process.env })
  if (r.status !== 0) {
    log(`host-ops refresh failed (continuing): ${(r.stderr || r.stdout || '').trim()}`)
  }
}

async function updateScheduleAfterRun(
  backupName: string,
  timestamp: string,
  runStatus: 'complete' | 'error'
): Promise<void> {
  const schedules = readSchedulesFile<ScheduleRecord>()
  const idx = schedules.findIndex((s) => s.backupName === backupName)
  if (idx === -1) return
  schedules[idx] = {
    ...schedules[idx],
    lastRun: timestamp,
    lastStatus: runStatus,
    nextRun: getNextRun(schedules[idx].cronExpression),
  }
  await writeSchedulesFile(schedules)
}

async function runScheduledBackup(config: RsyncConfig): Promise<void> {
  const startTime = Date.now()
  log(`Scheduled backup "${config.backupName}" started`)

  if (!tryAcquireRun(config.backupName, 'scheduled')) {
    log(`Skipped "${config.backupName}" — already running`)
    return
  }

  try {
    if (!ensureKioxiaIfNeeded(config.destDir)) {
      const timestamp = new Date().toISOString()
      const message = `Destination mount unavailable: ${config.destDir}`
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
      return
    }

    maybeRefreshHomeMeta(config.backupName)
    maybePullVmGuest(config.backupName)
    maybeRefreshHostOps(config.backupName)

    const validation = validatePaths(config.sourceDir, config.destDir)
    if (!validation.valid) {
      const message = validation.errors.join('; ')
      log(`Validation failed for "${config.backupName}": ${message}`)
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
      return
    }

    const proc = spawnRsyncProcess({ config })
    const result = await attachRsyncListeners(proc, { config })
    const duration = Date.now() - startTime
    const timestamp = new Date().toISOString()

    if (result.exitCode === null && result.stderr.includes('rsync is not installed')) {
      await appendHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        backupName: config.backupName,
        sourceDir: config.sourceDir,
        destDir: config.destDir,
        status: 'error',
        message: result.stderr,
        timestamp,
        filesChanged: 0,
        bytesTransferred: 0,
        duration,
      })
      await updateScheduleAfterRun(config.backupName, timestamp, 'error')
      log(`Error "${config.backupName}": ${result.stderr}`)
      return
    }

    const runStatus: 'complete' | 'error' = result.exitCode === 0 ? 'complete' : 'error'
    await updateScheduleAfterRun(config.backupName, timestamp, runStatus)

    if (result.exitCode === 0) {
      await appendHistory({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        backupName: config.backupName,
        sourceDir: config.sourceDir,
        destDir: config.destDir,
        status: 'complete',
        message: 'Scheduled backup completed successfully (headless)',
        timestamp,
        filesChanged: result.stats.filesChanged,
        bytesTransferred: result.stats.bytesTransferred,
        duration,
      })
      log(
        `Complete "${config.backupName}" files=${result.stats.filesChanged} bytes=${result.stats.bytesTransferred} duration=${duration}ms`
      )
    } else {
      const message = result.stderr.trim() || `rsync exited with code ${result.exitCode}`
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
        duration,
      })
      log(`Error "${config.backupName}": ${message}`)
    }
  } finally {
    releaseRun(config.backupName)
  }
}

function stopAllTasks(): void {
  for (const { task } of activeTasks.values()) {
    task.stop()
  }
  activeTasks.clear()
}

function syncCronFromDisk(): void {
  if (shuttingDown) return
  if (!fs.existsSync(SCHEDULES_FILE)) {
    if (activeTasks.size > 0) {
      log('schedules.json missing — stopping all tasks')
      stopAllTasks()
    }
    return
  }

  let schedules: ScheduleRecord[]
  try {
    schedules = readSchedulesFile<ScheduleRecord>()
  } catch (err) {
    log(`Failed to read schedules: ${err}`)
    return
  }

  const wanted = new Set<string>()

  for (const record of schedules) {
    if (!record.enabled) continue
    if (!cron.validate(record.cronExpression)) {
      log(`Invalid cron for "${record.backupName}": ${record.cronExpression}`)
      continue
    }
    wanted.add(record.backupName)
    const fp = fingerprint(record)
    const existing = activeTasks.get(record.backupName)
    if (existing && existing.fingerprint === fp) continue

    if (existing) {
      existing.task.stop()
      activeTasks.delete(record.backupName)
    }

    const backupConfig = record.backupConfig
    const task = cron.schedule(record.cronExpression, () => {
      void runScheduledBackup(backupConfig)
    })
    activeTasks.set(record.backupName, { task, fingerprint: fp })
    const next = getNextRun(record.cronExpression)
    log(`Registered "${record.backupName}" cron=${record.cronExpression} next=${next ?? '?'}`)
  }

  for (const name of [...activeTasks.keys()]) {
    if (!wanted.has(name)) {
      activeTasks.get(name)?.task.stop()
      activeTasks.delete(name)
      log(`Unregistered "${name}"`)
    }
  }
}

async function runOnce(name: string): Promise<number> {
  const schedules = readSchedulesFile<ScheduleRecord>()
  const record = schedules.find((s) => s.backupName === name)
  if (!record) {
    log(`No schedule named "${name}"`)
    return 1
  }
  await runScheduledBackup(record.backupConfig)
  return 0
}

function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  log(`Shutting down (${signal})`)
  if (reloadTimer) clearInterval(reloadTimer)
  stopAllTasks()
  removePidFile()
  process.exit(0)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args[0] === '--run-once' && args[1]) {
    process.exitCode = await runOnce(args[1])
    return
  }
  if (args[0] === '--status') {
    const running = isDaemonRunning()
    console.log(running ? 'running' : 'stopped')
    if (running && fs.existsSync(PID_FILE)) {
      console.log(`pid=${fs.readFileSync(PID_FILE, 'utf-8').trim()}`)
    }
    return
  }

  writePidFile()
  log(`Daemon started pid=${process.pid} schedules=${SCHEDULES_FILE}`)
  syncCronFromDisk()
  reloadTimer = setInterval(syncCronFromDisk, RELOAD_MS)

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGHUP', () => {
    log('SIGHUP — reloading schedules')
    syncCronFromDisk()
  })
}

void main().catch((err) => {
  console.error(err)
  removePidFile()
  process.exit(1)
})
