import type {
  RsyncConfig,
  BackupRecord,
  RsyncResult,
  RsyncProgress,
  ValidationResult,
  ScheduleRecord,
  ScheduleFrequency,
} from './types'

let mockConfig: RsyncConfig | null = null

let mockSchedules: ScheduleRecord[] = [
  {
    id: 'mock-sched-1',
    backupName: 'Mock Backup',
    cronExpression: '0 2 * * *',
    enabled: true,
    frequency: 'daily',
    time: '02:00',
    dayOfWeek: 0,
    backupConfig: {
      sourceDir: '/mock/source',
      destDir: '/mock/dest',
      backupName: 'Mock Backup',
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    lastStatus: 'complete',
    nextRun: new Date(Date.now() + 82800000).toISOString(),
  },
]

const mockAPI = {
  backup: {
    execute: async (config: RsyncConfig): Promise<RsyncResult> => {
      await new Promise((r) => setTimeout(r, 1000))
      return {
        status: 'complete',
        message: '(Mock) Backup completed',
        timestamp: new Date().toISOString(),
        filesChanged: 42,
        bytesTransferred: 1024000,
        duration: 5000,
      }
    },

    validatePaths: async (sourceDir: string, destDir: string): Promise<ValidationResult> => {
      await new Promise((r) => setTimeout(r, 300))
      if (!sourceDir || !destDir) {
        return { valid: false, errors: ['Paths are required'] }
      }
      return { valid: true, errors: [] }
    },

    getHistory: async (): Promise<BackupRecord[]> => {
      await new Promise((r) => setTimeout(r, 200))
      return [
        {
          id: '1',
          backupName: 'Mock Backup',
          sourceDir: '/mock/source',
          destDir: '/mock/dest',
          status: 'complete',
          message: '(Mock) Completed successfully',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          filesChanged: 25,
          bytesTransferred: 512000,
          duration: 3000,
        },
      ]
    },

    getConfig: async (): Promise<RsyncConfig | null> => {
      return mockConfig
    },

    saveConfig: async (config: RsyncConfig): Promise<{ success: boolean; message?: string }> => {
      mockConfig = config
      return { success: true }
    },

    cancel: async (_backupName: string): Promise<{ success: boolean }> => {
      return { success: true }
    },

    schedule: async (req: {
      enabled: boolean
      cronExpression: string
      backupConfig: RsyncConfig
      frequency?: ScheduleFrequency
      time?: string
      dayOfWeek?: number
    }) => {
      return { success: true, message: '(Mock) Schedule configured' }
    },

    getSchedules: async (): Promise<ScheduleRecord[]> => {
      await new Promise((r) => setTimeout(r, 200))
      return [...mockSchedules]
    },

    updateSchedule: async (
      id: string,
      updates: Partial<
        Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'frequency' | 'time' | 'dayOfWeek' | 'backupConfig'>
      >
    ): Promise<ScheduleRecord | null> => {
      await new Promise((r) => setTimeout(r, 200))
      const idx = mockSchedules.findIndex((s) => s.id === id)
      if (idx === -1) return null
      const updated = { ...mockSchedules[idx], ...updates }
      mockSchedules = mockSchedules.map((s) => (s.id === id ? updated : s))
      return updated
    },

    deleteSchedule: async (id: string): Promise<{ success: boolean }> => {
      await new Promise((r) => setTimeout(r, 200))
      const exists = mockSchedules.some((s) => s.id === id)
      if (!exists) return { success: false }
      mockSchedules = mockSchedules.filter((s) => s.id !== id)
      return { success: true }
    },

    onProgress: (handler: (data: RsyncProgress) => void) => {
      const timer = setInterval(() => {
        handler({
          status: 'syncing',
          filesTransferred: Math.floor(Math.random() * 100),
          speed: '12.5 MB/s',
          eta: '00:30',
          currentFile: 'src/main/ipc.ts',
        })
      }, 1000)
      return () => clearInterval(timer)
    },

    onScheduledResult: (_handler: (data: { backupName: string; status: 'complete' | 'error'; message?: string; filesChanged?: number }) => void) => {
      return () => {}
    },
  },
}

export function getElectronAPI() {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI
  }
  return mockAPI
}