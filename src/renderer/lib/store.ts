import { create } from 'zustand'
import type { BackupRecord, RsyncConfig, RsyncProgress } from './types'
import { getElectronAPI } from './electron-mock'

interface BackupStore {
  config: RsyncConfig | null
  setConfig: (config: RsyncConfig) => Promise<void>

  isRunning: boolean
  progress: RsyncProgress | null

  history: BackupRecord[]

  startBackup: () => Promise<void>
  cancelBackup: () => Promise<void>
  loadHistory: () => Promise<void>
}

export const useBackupStore = create<BackupStore>((set, get) => ({
  config: null,

  setConfig: async (config) => {
    set({ config })
    // Apply schedule change immediately whenever config is saved
    if (config.schedule) {
      await getElectronAPI().backup.schedule({
        enabled: config.schedule.enabled,
        cronExpression: config.schedule.cronExpression,
        backupConfig: config,
      })
    }
  },

  isRunning: false,
  progress: null,

  history: [],

  startBackup: async () => {
    const { config } = get()
    if (!config) return

    // Register progress listener BEFORE invoke (prevents race condition)
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
}))
