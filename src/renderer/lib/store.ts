import { create } from 'zustand'
import type { BackupRecord, RsyncConfig, RsyncProgress, ScheduleRecord } from './types'
import { getElectronAPI } from './electron-mock'

interface BackupStore {
  config: RsyncConfig | null
  setConfig: (config: RsyncConfig) => Promise<void>
  loadConfig: () => Promise<void>

  isRunning: boolean
  progress: RsyncProgress | null
  scheduledNotification: string | null

  history: BackupRecord[]

  schedules: ScheduleRecord[]
  loadSchedules: () => Promise<void>
  toggleSchedule: (id: string, enabled: boolean) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>

  startBackup: () => Promise<void>
  cancelBackup: () => Promise<void>
  loadHistory: () => Promise<void>
  initListeners: () => () => void
}

export const useBackupStore = create<BackupStore>((set, get) => ({
  config: null,

  loadConfig: async () => {
    const config = await getElectronAPI().backup.getConfig()
    if (config) set({ config })
  },

  setConfig: async (config) => {
    const saveResult = await getElectronAPI().backup.saveConfig(config)
    if (!saveResult.success) {
      throw new Error(saveResult.message ?? 'Failed to save configuration')
    }
    set({ config })

    if (config.schedule) {
      await getElectronAPI().backup.schedule({
        enabled: config.schedule.enabled,
        cronExpression: config.schedule.cronExpression,
        backupConfig: config,
        frequency: config.schedule.frequency,
        time: config.schedule.time,
        dayOfWeek: config.schedule.dayOfWeek,
      })
    }
  },

  isRunning: false,
  progress: null,
  scheduledNotification: null,

  history: [],

  schedules: [],

  loadSchedules: async () => {
    const schedules = await getElectronAPI().backup.getSchedules()
    set({ schedules })
  },

  toggleSchedule: async (id, enabled) => {
    const updated = await getElectronAPI().backup.updateSchedule(id, { enabled })
    if (updated) {
      set((state) => ({
        schedules: state.schedules.map((s) => (s.id === id ? updated : s)),
      }))
    }
  },

  deleteSchedule: async (id) => {
    const result = await getElectronAPI().backup.deleteSchedule(id)
    if (result.success) {
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
      }))
    }
  },

  startBackup: async () => {
    const { config } = get()
    if (!config) return

    const cleanup = getElectronAPI().backup.onProgress((data: RsyncProgress) => {
      set({ progress: data })
    })

    set({ isRunning: true, progress: null })
    try {
      const result = await getElectronAPI().backup.execute(config)
      set({ progress: { status: result.status, message: result.message } })
    } finally {
      cleanup()
      set({ isRunning: false })
      get().loadHistory()
    }
  },

  cancelBackup: async () => {
    const { config } = get()
    if (config) {
      await getElectronAPI().backup.cancel(config.backupName)
    }
  },

  loadHistory: async () => {
    const history = await getElectronAPI().backup.getHistory()
    set({ history })
  },

  initListeners: () => {
    const api = getElectronAPI().backup
    if (!api.onScheduledResult) return () => {}

    const cleanup = api.onScheduledResult((data: {
      backupName: string
      status: 'complete' | 'error'
      message?: string
      filesChanged?: number
    }) => {
      const message =
        data.status === 'complete'
          ? `Scheduled backup "${data.backupName}" completed (${data.filesChanged ?? 0} files)`
          : `Scheduled backup "${data.backupName}" failed: ${data.message ?? 'unknown error'}`
      set({ scheduledNotification: message })
      get().loadSchedules()
      get().loadHistory()
    })

    return cleanup
  },
}))