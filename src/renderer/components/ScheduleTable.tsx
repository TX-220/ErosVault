import type { ScheduleRecord } from '../lib/types'

interface Props {
  schedules: ScheduleRecord[]
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  onEdit: (schedule: ScheduleRecord) => void
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function frequencyLabel(schedule: ScheduleRecord): string {
  switch (schedule.frequency) {
    case 'daily':
      return `Daily at ${schedule.time}`
    case 'weekly': {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return `Weekly on ${days[schedule.dayOfWeek]} at ${schedule.time}`
    }
    case 'monthly':
      return `Monthly at ${schedule.time}`
    case 'custom':
      return `Custom: ${schedule.cronExpression}`
    default:
      return schedule.cronExpression
  }
}

export function ScheduleTable({ schedules, onToggle, onDelete, onEdit }: Props) {
  if (schedules.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No schedules configured yet. Configure a backup with a schedule to see it here.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
            <th className="py-3 pr-4 font-medium">Backup</th>
            <th className="py-3 pr-4 font-medium">Frequency</th>
            <th className="py-3 pr-4 font-medium">Last Run</th>
            <th className="py-3 pr-4 font-medium">Next Run</th>
            <th className="py-3 pr-4 font-medium">Status</th>
            <th className="py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {schedules.map((sched) => (
            <tr
              key={sched.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">
                {sched.backupName}
              </td>
              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                {frequencyLabel(sched)}
              </td>
              <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                {formatDate(sched.lastRun)}
              </td>
              <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                {sched.enabled ? formatDate(sched.nextRun) : '—'}
              </td>
              <td className="py-3 pr-4">
                {sched.lastStatus === 'complete' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Success
                  </span>
                )}
                {sched.lastStatus === 'error' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    Error
                  </span>
                )}
                {!sched.lastStatus && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    Never run
                  </span>
                )}
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  {/* Enable/disable toggle */}
                  <button
                    onClick={() => onToggle(sched.id, !sched.enabled)}
                    title={sched.enabled ? 'Disable schedule' : 'Enable schedule'}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      sched.enabled
                        ? 'bg-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        sched.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => onEdit(sched)}
                    title="Edit schedule"
                    className="p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => onDelete(sched.id)}
                    title="Delete schedule"
                    className="p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
