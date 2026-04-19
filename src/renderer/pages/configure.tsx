import { useEffect, useState } from 'react'
import { useBackupStore } from '@/lib/store'
import { Layout } from '@/components/Layout'
import { BackupForm } from '@/components/BackupForm'
import { ProgressBar } from '@/components/ProgressBar'
import type { RsyncConfig } from '@/lib/types'

export default function Configure() {
  const [mounted, setMounted] = useState(false)
  const [isElectron, setIsElectron] = useState(true)
  const { config, setConfig, startBackup, isRunning, progress, cancelBackup } = useBackupStore()

  useEffect(() => {
    setMounted(true)
    // Check if running in Electron (has window.electronAPI)
    const hasElectronAPI = typeof window !== 'undefined' && (window as any).electronAPI !== undefined
    setIsElectron(hasElectronAPI)
  }, [])

  const handleSave = async (cfg: RsyncConfig) => {
    await setConfig(cfg)
  }

  const handleExecute = async (cfg: RsyncConfig) => {
    await setConfig(cfg)
    await startBackup()
  }

  if (!mounted) return null

  return (
    <Layout>
      {!isElectron && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">Browser Mode - Limited Functionality</p>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                Backup execution is only available in the desktop application. Please download and run the Replicant desktop app to perform backups.
              </p>
            </div>
          </div>
        </div>
      )}

      <ProgressBar progress={progress} isRunning={isRunning} onCancel={cancelBackup} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Backup Configuration
        </h2>
        <BackupForm
          initialConfig={config}
          isRunning={isRunning}
          onSave={handleSave}
          onExecute={handleExecute}
          isElectron={isElectron}
        />
      </div>
    </Layout>
  )
}
