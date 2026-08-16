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
        <div className="ev-panel p-4 border-amber-500/30">
          <div className="flex gap-3">
            <div className="text-2xl" aria-hidden>⚠</div>
            <div>
              <p className="font-semibold text-amber-200">Browser Mode — Limited Functionality</p>
              <p className="text-sm text-amber-100/80 mt-1">
                Backup execution is only available in the desktop application. Launch the ErosVault
                desktop app to perform backups.
              </p>
            </div>
          </div>
        </div>
      )}

      <ProgressBar progress={progress} isRunning={isRunning} onCancel={cancelBackup} />

      <div className="ev-panel p-6">
        <h2 className="ev-title text-lg mb-1">Backup Configuration</h2>
        <p className="ev-muted text-sm mb-6">Source, destination, exclusions, and schedule for this vault job.</p>
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
