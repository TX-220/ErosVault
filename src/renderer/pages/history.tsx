import { useEffect, useState } from 'react'
import { useBackupStore } from '@/lib/store'
import { Layout } from '@/components/Layout'
import { HistoryTable } from '@/components/HistoryTable'

export default function History() {
  const [mounted, setMounted] = useState(false)
  const { history, loadHistory } = useBackupStore()

  useEffect(() => {
    setMounted(true)
    loadHistory()
  }, [loadHistory])

  if (!mounted) return null

  return (
    <Layout>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Backup History</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{history.length} records</span>
        </div>
        <HistoryTable history={history} />
      </div>
    </Layout>
  )
}
