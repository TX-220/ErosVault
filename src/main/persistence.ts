import fs from 'fs'
import path from 'path'
import os from 'os'
import type { BackupRecord, RsyncConfig } from '../renderer/lib/types'

export const DATA_DIR = path.join(os.homedir(), '.backup-app')
export const HISTORY_FILE = path.join(DATA_DIR, 'history.json')
export const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
export const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json')

const MAX_HISTORY = 500

let writeChain: Promise<void> = Promise.resolve()

function enqueueWrite(task: () => void): Promise<void> {
  writeChain = writeChain
    .then(task)
    .catch((err) => {
      console.error('[persistence] write failed:', err)
    })
  return writeChain
}

export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function atomicWriteSync(filePath: string, content: string): void {
  ensureDataDir()
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, filePath)
}

export function readHistory(): BackupRecord[] {
  ensureDataDir()
  if (!fs.existsSync(HISTORY_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as BackupRecord[]
  } catch {
    return []
  }
}

export async function appendHistory(record: BackupRecord | object): Promise<void> {
  await enqueueWrite(() => {
    const history = readHistory()
    history.unshift(record as BackupRecord)
    atomicWriteSync(HISTORY_FILE, JSON.stringify(history.slice(0, MAX_HISTORY), null, 2))
  })
}

export function readConfig(): RsyncConfig | null {
  ensureDataDir()
  if (!fs.existsSync(CONFIG_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as RsyncConfig
  } catch {
    return null
  }
}

export async function writeConfig(config: RsyncConfig): Promise<void> {
  await enqueueWrite(() => {
    atomicWriteSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  })
}

export function readSchedulesFile<T>(): T[] {
  ensureDataDir()
  if (!fs.existsSync(SCHEDULES_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8')) as T[]
  } catch {
    return []
  }
}

export async function writeSchedulesFile<T>(schedules: T[]): Promise<void> {
  await enqueueWrite(() => {
    atomicWriteSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2))
  })
}

export function writeSchedulesFileSync<T>(schedules: T[]): void {
  atomicWriteSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2))
}