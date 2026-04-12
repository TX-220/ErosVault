import { contextBridge, ipcRenderer } from 'electron'
import type { RsyncConfig, BackupRecord, RsyncResult, RsyncProgress, ValidationResult } from '../renderer/lib/types'

export interface ElectronAPI {
  backup: {
    execute: (config: RsyncConfig) => Promise<RsyncResult>
    validatePaths: (sourceDir: string, destDir: string) => Promise<ValidationResult>
    getHistory: () => Promise<BackupRecord[]>
    cancel: (backupName: string) => Promise<{ success: boolean }>
    schedule: (req: {
      enabled: boolean
      cronExpression: string
      backupConfig: RsyncConfig
    }) => Promise<{ success: boolean; message: string }>
    onProgress: (handler: (data: RsyncProgress) => void) => () => void
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  backup: {
    execute: (config: RsyncConfig) => ipcRenderer.invoke('backup:execute', config),

    validatePaths: (sourceDir: string, destDir: string) =>
      ipcRenderer.invoke('backup:validate-paths', { sourceDir, destDir }),

    getHistory: () => ipcRenderer.invoke('backup:get-history'),

    cancel: (backupName: string) => ipcRenderer.invoke('backup:cancel', backupName),

    schedule: (req: {
      enabled: boolean
      cronExpression: string
      backupConfig: RsyncConfig
    }) => ipcRenderer.invoke('backup:schedule', req),

    onProgress: (handler: (data: RsyncProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: RsyncProgress) => handler(data)
      ipcRenderer.on('backup:progress', listener)
      return () => ipcRenderer.removeListener('backup:progress', listener)
    },
  },
} satisfies ElectronAPI)
