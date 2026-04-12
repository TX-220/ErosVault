import type { RsyncConfig, BackupRecord, RsyncResult, RsyncProgress, ValidationResult } from './types'

// Mock implementation for browser dev mode (when not in Electron)
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

    cancel: async (backupName: string): Promise<{ success: boolean }> => {
      return { success: true }
    },

    schedule: async (req: {
      enabled: boolean
      cronExpression: string
      backupConfig: RsyncConfig
    }) => {
      return { success: true, message: '(Mock) Schedule configured' }
    },

    onProgress: (handler: (data: RsyncProgress) => void) => {
      // Simulate progress events
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
  },
}

// Get the real or mock API
export function getElectronAPI() {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI
  }
  return mockAPI
}
