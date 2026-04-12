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
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg mb-1">No backups yet</p>
        <p className="text-sm">Configure a backup and run it to see history here.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-left">
            <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Date</th>
            <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
            <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
            <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Files Changed</th>
            <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Size</th>
            <th className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">Duration</th>
          </tr>
        </thead>
        <tbody>
          {history.map((record, idx) => (
            <tr
              key={record.id}
              title={record.status === 'error' ? record.message : undefined}
              className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'
              }`}
            >
              <td className="px-6 py-4 text-gray-900 dark:text-white whitespace-nowrap">
                {new Date(record.timestamp).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{record.backupName}</td>
              <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  record.status === 'complete'
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                }`}>
                  {record.status === 'complete' ? '✓ Success' : '✗ Error'}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-900 dark:text-white">{record.filesChanged}</td>
              <td className="px-6 py-4 text-gray-900 dark:text-white">{formatBytes(record.bytesTransferred)}</td>
              <td className="px-6 py-4 text-gray-900 dark:text-white">{formatDuration(record.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
