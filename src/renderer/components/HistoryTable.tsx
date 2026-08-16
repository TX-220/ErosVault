import type { BackupRecord } from '@/lib/types'

interface Props {
  history: BackupRecord[]
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

export function HistoryTable({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 ev-muted">
        <p className="text-lg mb-1 text-nebula-300">No backups yet</p>
        <p className="text-sm">Configure a backup and run it to see history here.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-nebula-600/20 bg-void-800/40">
            <th className="px-6 py-3 ev-table-head">Date</th>
            <th className="px-6 py-3 ev-table-head">Name</th>
            <th className="px-6 py-3 ev-table-head">Status</th>
            <th className="px-6 py-3 ev-table-head">Files Changed</th>
            <th className="px-6 py-3 ev-table-head">Size</th>
            <th className="px-6 py-3 ev-table-head">Duration</th>
          </tr>
        </thead>
        <tbody>
          {history.map((record) => (
            <tr
              key={record.id}
              title={record.status === 'error' ? record.message : undefined}
              className="border-b border-nebula-600/10 hover:bg-nebula-600/5 transition"
            >
              <td className="px-6 py-4 text-nebula-300 whitespace-nowrap">
                {new Date(record.timestamp).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-white font-medium">{record.backupName}</td>
              <td className="px-6 py-4">
                <span className={record.status === 'complete' ? 'ev-badge-ok' : 'ev-badge-err'}>
                  {record.status === 'complete' ? '✓ Success' : '✗ Error'}
                </span>
              </td>
              <td className="px-6 py-4 text-nebula-300">{record.filesChanged}</td>
              <td className="px-6 py-4 text-nebula-300">{formatBytes(record.bytesTransferred)}</td>
              <td className="px-6 py-4 text-nebula-300">{formatDuration(record.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
