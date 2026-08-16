import { useState, useEffect } from 'react'
import type { RsyncConfig, ScheduleConfig, ValidationResult } from '@/lib/types'
import { getElectronAPI } from '@/lib/electron-mock'
import { DEFAULT_EXCLUSIONS, EXCLUSION_DESCRIPTIONS } from '@shared/constants'

interface Props {
  initialConfig: RsyncConfig | null
  isRunning: boolean
  onSave: (config: RsyncConfig) => void
  onExecute: (config: RsyncConfig) => void
  isElectron?: boolean
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: false,
  frequency: 'daily',
  time: '02:00',
  dayOfWeek: 0,
  cronExpression: '0 2 * * *',
}

const DEFAULT_FORM: RsyncConfig = {
  sourceDir: '',
  destDir: '',
  backupName: '',
  excludePatterns: ['.git', 'node_modules', '.DS_Store'],
  schedule: DEFAULT_SCHEDULE,
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function buildCronExpression(schedule: ScheduleConfig): string {
  if (schedule.frequency === 'custom') return schedule.cronExpression
  const [hours, minutes] = schedule.time.split(':')
  const h = parseInt(hours ?? '2')
  const m = parseInt(minutes ?? '0')
  if (schedule.frequency === 'daily') return `${m} ${h} * * *`
  if (schedule.frequency === 'weekly') return `${m} ${h} * * ${schedule.dayOfWeek}`
  if (schedule.frequency === 'monthly') return `${m} ${h} 1 * *`
  return schedule.cronExpression
}

export function BackupForm({ initialConfig, isRunning, onSave, onExecute, isElectron = true }: Props) {
  const [formData, setFormData] = useState<RsyncConfig>(initialConfig ?? DEFAULT_FORM)
  const [excludeRaw, setExcludeRaw] = useState(
    (initialConfig?.excludePatterns ?? DEFAULT_FORM.excludePatterns!).join(', ')
  )
  const [schedule, setSchedule] = useState<ScheduleConfig>(
    initialConfig?.schedule ?? DEFAULT_SCHEDULE
  )
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)

  useEffect(() => {
    if (initialConfig) {
      setFormData(initialConfig)
      setExcludeRaw(initialConfig.excludePatterns?.join(', ') ?? '')
      setSchedule(initialConfig.schedule ?? DEFAULT_SCHEDULE)
    }
  }, [initialConfig])

  const updateSchedule = (patch: Partial<ScheduleConfig>) => {
    setSchedule((prev) => {
      const next = { ...prev, ...patch }
      next.cronExpression = buildCronExpression(next)
      return next
    })
    setScheduleSaved(false)
  }

  const currentConfig = (): RsyncConfig => ({
    ...formData,
    excludePatterns: excludeRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    schedule: { ...schedule, cronExpression: buildCronExpression(schedule) },
  })

  const handleValidate = async () => {
    setValidating(true)
    setValidation(null)
    try {
      const api = getElectronAPI()
      const result = await api.backup.validatePaths(
        formData.sourceDir,
        formData.destDir
      )
      setValidation(result)
    } finally {
      setValidating(false)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(currentConfig())
    setScheduleSaved(true)
  }

  const handleExecute = () => {
    onExecute(currentConfig())
  }

  const isValid = formData.backupName && formData.sourceDir && formData.destDir

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="ev-label">Backup Name</label>
        <input
          type="text"
          value={formData.backupName}
          onChange={(e) => setFormData({ ...formData, backupName: e.target.value })}
          placeholder="e.g. Trading Bot Backup"
          required
          className="ev-input"
        />
      </div>

      <div>
        <label className="ev-label">Source Directory</label>
        <input
          type="text"
          value={formData.sourceDir}
          onChange={(e) => {
            setFormData({ ...formData, sourceDir: e.target.value })
            setValidation(null)
          }}
          placeholder="/home/user/project"
          required
          className="ev-input font-mono"
        />
      </div>

      <div>
        <label className="ev-label">Destination Directory</label>
        <input
          type="text"
          value={formData.destDir}
          onChange={(e) => {
            setFormData({ ...formData, destDir: e.target.value })
            setValidation(null)
          }}
          placeholder="/mnt/backup"
          required
          className="ev-input font-mono"
        />
      </div>

      <div className="space-y-3">
        <div>
          <label className="ev-label">Exclusion Patterns</label>

          <div className="mb-3">
            <p className="text-xs font-medium text-nebula-400 mb-2">
              Always Excluded (default):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DEFAULT_EXCLUSIONS.map((pattern: string) => (
                <div
                  key={pattern}
                  className="px-3 py-2 rounded-lg text-sm border border-nebula-600/15 bg-void-950/50"
                >
                  <div className="font-mono text-nebula-300">{pattern}</div>
                  <div className="text-xs ev-muted">{EXCLUSION_DESCRIPTIONS[pattern]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="my-3 p-3 rounded-lg text-sm border border-nebula-500/25 bg-nebula-700/10">
            <p className="text-xs font-medium text-nebula-300 mb-1">Python Virtual Environments</p>
            <p className="text-xs text-nebula-400">
              Virtual environments (venv, .venv, env) are excluded by default. After restoring:{' '}
              <code className="font-mono bg-void-950/80 px-1 rounded text-rose-soft">
                python -m venv venv && pip install -r requirements.txt
              </code>
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-nebula-400 mb-1 block">
              Additional Custom Exclusions (comma-separated):
            </label>
            <input
              type="text"
              value={excludeRaw}
              onChange={(e) => setExcludeRaw(e.target.value)}
              placeholder="e.g. .idea, .vscode, dist"
              className="ev-input font-mono"
            />
            <p className="text-xs ev-muted mt-1">These are added to the default exclusions above</p>
          </div>
        </div>
      </div>

      {validation && (
        <div
          className={`p-3 rounded-lg text-sm border ${
            validation.valid
              ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-300'
              : 'bg-red-900/20 border-red-500/30 text-red-300'
          }`}
        >
          {validation.valid ? (
            <p className="font-medium">✓ Source accessible &nbsp;✓ Destination writable</p>
          ) : (
            <ul className="space-y-1 list-disc list-inside">
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="ev-panel p-4 space-y-4 !shadow-none">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => updateSchedule({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-nebula-600/40 text-rose-deep focus:ring-nebula-500 bg-void-900"
          />
          <span className="text-sm font-medium text-nebula-300">Enable Scheduled Backup</span>
        </label>

        {schedule.enabled && (
          <div className="space-y-3 pl-7">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm ev-muted w-20">Frequency</label>
              <select
                value={schedule.frequency}
                onChange={(e) =>
                  updateSchedule({ frequency: e.target.value as ScheduleConfig['frequency'] })
                }
                className="ev-input !w-auto"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom cron</option>
              </select>

              {(schedule.frequency === 'daily' ||
                schedule.frequency === 'weekly' ||
                schedule.frequency === 'monthly') && (
                <>
                  <span className="text-sm ev-muted">@</span>
                  <input
                    type="time"
                    value={schedule.time}
                    onChange={(e) => updateSchedule({ time: e.target.value })}
                    className="ev-input !w-auto"
                  />
                </>
              )}

              {schedule.frequency === 'weekly' && (
                <select
                  value={schedule.dayOfWeek}
                  onChange={(e) => updateSchedule({ dayOfWeek: parseInt(e.target.value) })}
                  className="ev-input !w-auto"
                >
                  {DAY_NAMES.map((day, i) => (
                    <option key={day} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {schedule.frequency === 'custom' && (
              <div className="flex items-center gap-3">
                <label className="text-sm ev-muted w-20">Cron</label>
                <input
                  type="text"
                  value={schedule.cronExpression}
                  onChange={(e) => updateSchedule({ cronExpression: e.target.value })}
                  placeholder="0 2 * * *"
                  className="ev-input font-mono flex-1"
                />
              </div>
            )}

            <p className="text-xs text-nebula-400/70 font-mono">
              cron: {buildCronExpression(schedule)}
            </p>

            {scheduleSaved && (
              <p className="text-xs text-emerald-400">✓ Schedule saved and active</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handleValidate}
          disabled={validating || !formData.sourceDir || !formData.destDir}
          className="ev-btn-secondary"
        >
          {validating ? 'Checking...' : 'Validate Paths'}
        </button>

        <button type="submit" disabled={!isValid} className="ev-btn-primary">
          Save Configuration
        </button>

        <button
          type="button"
          onClick={handleExecute}
          disabled={isRunning || !isValid || !isElectron}
          title={!isElectron ? 'Only available in desktop app' : ''}
          className="ev-btn-success"
        >
          {isRunning ? 'Backup Running...' : 'Execute Backup Now'}
        </button>
      </div>
    </form>
  )
}
