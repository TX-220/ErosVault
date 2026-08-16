import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useBackupStore } from '@/lib/store'
import { Layout } from '@/components/Layout'
import { ProgressBar } from '@/components/ProgressBar'

export default function Dashboard() {
  const [mounted, setMounted] = useState(false)
  const { isRunning, progress, history, loadHistory, cancelBackup } = useBackupStore()

  useEffect(() => {
    setMounted(true)
    loadHistory()
  }, [loadHistory])

  if (!mounted) return null

  const lastBackup = history[0]
  const successCount = history.filter((h) => h.status === 'complete').length

  return (
    <Layout>
      <ProgressBar progress={progress} isRunning={isRunning} onCancel={cancelBackup} />

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="ev-panel p-4">
          <p className="text-xs uppercase tracking-wider ev-muted">Total runs</p>
          <p className="mt-1 text-2xl font-semibold text-white">{history.length}</p>
        </div>
        <div className="ev-panel p-4">
          <p className="text-xs uppercase tracking-wider ev-muted">Successes</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{successCount}</p>
        </div>
        <div className="ev-panel p-4">
          <p className="text-xs uppercase tracking-wider ev-muted">Status</p>
          <p className="mt-1 text-2xl font-semibold text-rose-glow">
            {isRunning ? 'Running' : 'Idle'}
          </p>
        </div>
      </div>

      <div className="ev-panel p-6">
        <h2 className="ev-title text-lg mb-4">Last Backup</h2>

        {lastBackup ? (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="ev-muted text-xs uppercase tracking-wide">Date</dt>
              <dd className="font-medium text-white mt-1">
                {new Date(lastBackup.timestamp).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="ev-muted text-xs uppercase tracking-wide">Status</dt>
              <dd className="mt-1">
                <span className={lastBackup.status === 'complete' ? 'ev-badge-ok' : 'ev-badge-err'}>
                  {lastBackup.status === 'complete' ? '✓ Success' : '✗ Error'}
                </span>
              </dd>
            </div>
            <div>
              <dt className="ev-muted text-xs uppercase tracking-wide">Files Changed</dt>
              <dd className="font-medium text-white mt-1">{lastBackup.filesChanged}</dd>
            </div>
            <div>
              <dt className="ev-muted text-xs uppercase tracking-wide">Duration</dt>
              <dd className="font-medium text-white mt-1">
                {(lastBackup.duration / 1000).toFixed(1)}s
              </dd>
            </div>
          </dl>
        ) : (
          <p className="ev-muted text-sm">No backups yet. Configure a job and open the vault.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/configure" className="ev-btn-primary">
          Configure &amp; Run Backup
        </Link>
        <Link href="/history" className="ev-btn-secondary">
          View History
        </Link>
        <Link href="/schedules" className="ev-btn-secondary">
          Schedules
        </Link>
      </div>
    </Layout>
  )
}
