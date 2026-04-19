import { useState, useEffect } from 'react'
import type { ScheduleRecord, ScheduleFrequency } from '../lib/types'
import { getElectronAPI } from '../lib/electron-mock'

interface Props {
  schedule: ScheduleRecord
  onClose: () => void
  onSaved: (updated: ScheduleRecord) => void
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function buildCron(frequency: ScheduleFrequency, time: string, dayOfWeek: number, custom: string): string {
  const [hh, mm] = time.split(':').map(Number)
  switch (frequency) {
    case 'daily':
      return `${mm} ${hh} * * *`
    case 'weekly':
      return `${mm} ${hh} * * ${dayOfWeek}`
    case 'monthly':
      return `${mm} ${hh} 1 * *`
    case 'custom':
      return custom
  }
}

export function ScheduleModal({ schedule, onClose, onSaved }: Props) {
  const [frequency, setFrequency] = useState<ScheduleFrequency>(schedule.frequency)
  const [time, setTime] = useState(schedule.time)
  const [dayOfWeek, setDayOfWeek] = useState(schedule.dayOfWeek)
  const [customCron, setCustomCron] = useState(
    schedule.frequency === 'custom' ? schedule.cronExpression : '0 2 * * *'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cronExpression = buildCron(frequency, time, dayOfWeek, customCron)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await getElectronAPI().backup.updateSchedule(schedule.id, {
        cronExpression,
        frequency,
        time,
        dayOfWeek,
      })
      if (updated) {
        onSaved(updated)
      } else {
        setError('Failed to update schedule — check the cron expression.')
      }
    } finally {
      setSaving(false)
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit Schedule — {schedule.backupName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Frequency
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['daily', 'weekly', 'monthly', 'custom'] as ScheduleFrequency[]).map((f) => (
              <button
                key={f}
                onClick={() => setFrequency(f)}
                className={`py-2 px-3 rounded-lg text-sm font-medium capitalize transition border ${
                  frequency === f
                    ? 'bg-blue-500 border-blue-500 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Time (daily/weekly/monthly) */}
        {frequency !== 'custom' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Day of week (weekly only) */}
        {frequency === 'weekly' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Day of Week
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DAYS.map((day, idx) => (
                <option key={day} value={idx}>{day}</option>
              ))}
            </select>
          </div>
        )}

        {/* Custom cron */}
        {frequency === 'custom' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Cron Expression
            </label>
            <input
              type="text"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="0 2 * * *"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Format: minute hour day-of-month month day-of-week
            </p>
          </div>
        )}

        {/* Preview */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Cron: </span>
          <span className="font-mono text-blue-600 dark:text-blue-400">{cronExpression}</span>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
