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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="ev-panel w-full max-w-md mx-4 p-6 space-y-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="ev-title text-lg">Edit Schedule — {schedule.backupName}</h2>
          <button onClick={onClose} className="text-nebula-400 hover:text-rose-soft transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <label className="ev-label">Frequency</label>
          <div className="grid grid-cols-4 gap-2">
            {(['daily', 'weekly', 'monthly', 'custom'] as ScheduleFrequency[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className={`py-2 px-3 rounded-lg text-sm font-medium capitalize transition border ${
                  frequency === f
                    ? 'border-transparent text-white'
                    : 'border-nebula-600/30 text-nebula-300 hover:border-rose-glow/40'
                }`}
                style={
                  frequency === f
                    ? { background: 'linear-gradient(135deg, #a855f7, #db2777)' }
                    : undefined
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {frequency !== 'custom' && (
          <div className="space-y-2">
            <label className="ev-label">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="ev-input"
            />
          </div>
        )}

        {frequency === 'weekly' && (
          <div className="space-y-2">
            <label className="ev-label">Day of Week</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="ev-input"
            >
              {DAYS.map((day, idx) => (
                <option key={day} value={idx}>
                  {day}
                </option>
              ))}
            </select>
          </div>
        )}

        {frequency === 'custom' && (
          <div className="space-y-2">
            <label className="ev-label">Cron Expression</label>
            <input
              type="text"
              value={customCron}
              onChange={(e) => setCustomCron(e.target.value)}
              placeholder="0 2 * * *"
              className="ev-input font-mono"
            />
            <p className="text-xs ev-muted">Format: minute hour day-of-month month day-of-week</p>
          </div>
        )}

        <div className="rounded-lg px-4 py-3 text-sm bg-void-950/70 border border-nebula-600/15">
          <span className="ev-muted">Cron: </span>
          <span className="font-mono text-rose-glow">{cronExpression}</span>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="ev-btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="ev-btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
