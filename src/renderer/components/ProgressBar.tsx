import type { RsyncProgress } from '@/lib/types'

interface Props {
  progress: RsyncProgress | null
  isRunning: boolean
  onCancel: () => void
}

export function ProgressBar({ progress, isRunning, onCancel }: Props) {
  if (!isRunning && !progress) return null

  const isComplete = progress?.status === 'complete'
  const isError = progress?.status === 'error'
  const isCancelled = progress?.status === 'cancelled'
  const isSyncing = progress?.status === 'syncing'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {isComplete
            ? 'Backup Complete'
            : isError
            ? 'Backup Failed'
            : isCancelled
            ? 'Backup Cancelled'
            : progress?.status === 'validating'
            ? 'Validating...'
            : 'Backup Running'}
        </h3>
        {isRunning && (
          <button
            onClick={onCancel}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition"
          >
            Stop Backup
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
        {isSyncing ? (
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
        ) : isComplete ? (
          <div className="h-full bg-green-500 rounded-full w-full" />
        ) : isError ? (
          <div className="h-full bg-red-500 rounded-full w-full" />
        ) : isCancelled ? (
          <div className="h-full bg-yellow-500 rounded-full w-full" />
        ) : (
          <div className="h-full bg-blue-400 rounded-full animate-pulse w-1/3" />
        )}
      </div>

      {/* Stats row */}
      {isSyncing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {progress.filesTransferred !== undefined && (
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Files Transferred</p>
              <p className="font-medium text-gray-900 dark:text-white">{progress.filesTransferred}</p>
            </div>
          )}
          {progress.speed && (
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Speed</p>
              <p className="font-medium text-gray-900 dark:text-white">{progress.speed}</p>
            </div>
          )}
          {progress.eta && (
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">ETA</p>
              <p className="font-medium text-gray-900 dark:text-white">{progress.eta}</p>
            </div>
          )}
          {progress.currentFile && (
            <div className="col-span-2 sm:col-span-1">
              <p className="text-gray-500 dark:text-gray-400 text-xs">Current File</p>
              <p className="font-medium text-gray-900 dark:text-white truncate text-xs" title={progress.currentFile}>
                {progress.currentFile}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status message */}
      {progress?.message && (
        <p className={`mt-3 text-sm ${
          isError
            ? 'text-red-600 dark:text-red-400'
            : isComplete
            ? 'text-green-600 dark:text-green-400'
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {progress.message}
        </p>
      )}
    </div>
  )
}
