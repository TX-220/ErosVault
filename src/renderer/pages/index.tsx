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

  return (
    <Layout>
      <ProgressBar progress={progress} isRunning={isRunning} onCancel={cancelBackup} />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Last Backup</h2>

        {lastBackup ? (
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Date</dt>
              <dd className="font-medium text-gray-900 dark:text-white mt-0.5">
                {new Date(lastBackup.timestamp).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Status</dt>
              <dd className={`font-medium mt-0.5 ${lastBackup.status === 'complete' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {lastBackup.status === 'complete' ? '✓ Success' : '✗ Error'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Files Changed</dt>
              <dd className="font-medium text-gray-900 dark:text-white mt-0.5">{lastBackup.filesChanged}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Duration</dt>
              <dd className="font-medium text-gray-900 dark:text-white mt-0.5">
                {(lastBackup.duration / 1000).toFixed(1)}s
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No backups yet.</p>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href="/configure"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
        >
          Configure &amp; Run Backup
        </Link>
        <Link
          href="/history"
          className="inline-block border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          View History
        </Link>
      </div>
    </Layout>
  )
}
