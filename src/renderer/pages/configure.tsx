import { useEffect, useState } from 'react'
import { useBackupStore } from '@/lib/store'
import { Layout } from '@/components/Layout'
import { BackupForm } from '@/components/BackupForm'
import { ProgressBar } from '@/components/ProgressBar'
import type { RsyncConfig } from '@/lib/types'

export default function Configure() {
  const [mounted, setMounted] = useState(false)
  const { config, setConfig, startBackup, isRunning, progress, cancelBackup } = useBackupStore()

  useEffect(() => {
    setMounted(true)
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
        />
      </div>
    </Layout>
  )
}
