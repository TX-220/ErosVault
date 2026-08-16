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
    <div className="ev-panel p-6 shadow-glow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="ev-title">
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
            className="text-sm text-red-400 hover:text-red-300 font-medium transition"
          >
            Stop Backup
          </button>
        )}
      </div>

      <div className="w-full h-3 rounded-full overflow-hidden mb-4 bg-void-950/80 border border-nebula-600/20">
        {isSyncing ? (
          <div
            className="h-full rounded-full animate-pulse w-full"
            style={{ background: 'linear-gradient(90deg, #a855f7, #f472b6, #a855f7)' }}
          />
        ) : isComplete ? (
          <div className="h-full bg-emerald-500 rounded-full w-full" />
        ) : isError ? (
          <div className="h-full bg-red-500 rounded-full w-full" />
        ) : isCancelled ? (
          <div className="h-full bg-amber-500 rounded-full w-full" />
        ) : (
          <div
            className="h-full rounded-full animate-pulse w-1/3"
            style={{ background: 'linear-gradient(90deg, #7c3aed, #db2777)' }}
          />
        )}
      </div>

      {isSyncing && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {progress.filesTransferred !== undefined && (
            <div>
              <p className="ev-muted text-xs">Files Transferred</p>
              <p className="font-medium text-white">{progress.filesTransferred}</p>
            </div>
          )}
          {progress.speed && (
            <div>
              <p className="ev-muted text-xs">Speed</p>
              <p className="font-medium text-white">{progress.speed}</p>
            </div>
          )}
          {progress.eta && (
            <div>
              <p className="ev-muted text-xs">ETA</p>
              <p className="font-medium text-white">{progress.eta}</p>
            </div>
          )}
          {progress.currentFile && (
            <div className="col-span-2 sm:col-span-1">
              <p className="ev-muted text-xs">Current File</p>
              <p className="font-medium text-white truncate text-xs" title={progress.currentFile}>
                {progress.currentFile}
              </p>
            </div>
          )}
        </div>
      )}

      {progress?.message && (
        <p
          className={`mt-3 text-sm ${
            isError
              ? 'text-red-400'
              : isComplete
              ? 'text-emerald-400'
              : 'ev-muted'
          }`}
        >
          {progress.message}
        </p>
      )}
    </div>
  )
}
