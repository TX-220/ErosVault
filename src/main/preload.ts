import { contextBridge, ipcRenderer } from 'electron'
import type {
  RsyncConfig,
  BackupRecord,
  RsyncResult,
  RsyncProgress,
  ValidationResult,
  ScheduleRecord,
  ScheduleFrequency,
} from '../renderer/lib/types'

export interface ScheduledResult {
  backupName: string
  status: 'complete' | 'error'
  message?: string
  filesChanged?: number
}

export interface ElectronAPI {
  backup: {
    execute: (config: RsyncConfig) => Promise<RsyncResult>
    validatePaths: (sourceDir: string, destDir: string) => Promise<ValidationResult>
    getHistory: () => Promise<BackupRecord[]>
    getConfig: () => Promise<RsyncConfig | null>
    saveConfig: (config: RsyncConfig) => Promise<{ success: boolean; message?: string }>
    cancel: (backupName: string) => Promise<{ success: boolean }>
    schedule: (req: {
      enabled: boolean
      cronExpression: string
      backupConfig: RsyncConfig
      frequency?: ScheduleFrequency
      time?: string
      dayOfWeek?: number
    }) => Promise<{ success: boolean; message: string; schedule?: ScheduleRecord }>
    getSchedules: () => Promise<ScheduleRecord[]>
    updateSchedule: (
      id: string,
      updates: Partial<
        Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'frequency' | 'time' | 'dayOfWeek' | 'backupConfig'>
      >
    ) => Promise<ScheduleRecord | null>
    deleteSchedule: (id: string) => Promise<{ success: boolean }>
    onProgress: (handler: (data: RsyncProgress) => void) => () => void
    onScheduledResult: (handler: (data: ScheduledResult) => void) => () => void
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  backup: {
    execute: (config: RsyncConfig) => ipcRenderer.invoke('backup:execute', config),

    validatePaths: (sourceDir: string, destDir: string) =>
      ipcRenderer.invoke('backup:validate-paths', { sourceDir, destDir }),

    getHistory: () => ipcRenderer.invoke('backup:get-history'),

    getConfig: () => ipcRenderer.invoke('backup:get-config'),

    saveConfig: (config: RsyncConfig) => ipcRenderer.invoke('backup:save-config', config),

    cancel: (backupName: string) => ipcRenderer.invoke('backup:cancel', backupName),

    schedule: (req: {
      enabled: boolean
      cronExpression: string
      backupConfig: RsyncConfig
      frequency?: ScheduleFrequency
      time?: string
      dayOfWeek?: number
    }) => ipcRenderer.invoke('backup:schedule', req),

    getSchedules: () => ipcRenderer.invoke('backup:get-schedules'),

    updateSchedule: (
      id: string,
      updates: Partial<
        Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'frequency' | 'time' | 'dayOfWeek' | 'backupConfig'>
      >
    ) => ipcRenderer.invoke('backup:update-schedule', { id, updates }),

    deleteSchedule: (id: string) => ipcRenderer.invoke('backup:delete-schedule', id),

    onProgress: (handler: (data: RsyncProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: RsyncProgress) => handler(data)
      ipcRenderer.on('backup:progress', listener)
      return () => ipcRenderer.removeListener('backup:progress', listener)
    },

    onScheduledResult: (handler: (data: ScheduledResult) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: ScheduledResult) => handler(data)
      ipcRenderer.on('backup:scheduled-result', listener)
      return () => ipcRenderer.removeListener('backup:scheduled-result', listener)
    },
  },
} satisfies ElectronAPI)