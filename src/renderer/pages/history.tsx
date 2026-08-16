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
      <div className="ev-panel overflow-hidden">
        <div className="p-6 border-b border-nebula-600/20 flex items-center justify-between">
          <div>
            <h2 className="ev-title text-lg">Backup History</h2>
            <p className="ev-muted text-sm mt-0.5">Audit trail of vault runs</p>
          </div>
          <span className="ev-badge-muted">{history.length} records</span>
        </div>
        <HistoryTable history={history} />
      </div>
    </Layout>
  )
}
