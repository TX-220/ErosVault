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

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm ' +
    'bg-white dark:bg-gray-700 text-gray-900 dark:text-white ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Backup Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Backup Name
        </label>
        <input
          type="text"
          value={formData.backupName}
          onChange={(e) => setFormData({ ...formData, backupName: e.target.value })}
          placeholder="e.g. Trading Bot Backup"
          required
          className={inputCls}
        />
      </div>

      {/* Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Source Directory
        </label>
        <input
          type="text"
          value={formData.sourceDir}
          onChange={(e) => {
            setFormData({ ...formData, sourceDir: e.target.value })
            setValidation(null)
          }}
          placeholder="/home/user/project"
          required
          className={`${inputCls} font-mono text-sm`}
        />
      </div>

      {/* Destination */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Destination Directory
        </label>
        <input
          type="text"
          value={formData.destDir}
          onChange={(e) => {
            setFormData({ ...formData, destDir: e.target.value })
            setValidation(null)
          }}
          placeholder="/mnt/backup"
          required
          className={`${inputCls} font-mono text-sm`}
        />
      </div>

      {/* Exclude Patterns */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Exclusion Patterns
          </label>

          {/* Default exclusions (read-only) */}
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              🔒 Always Excluded (default):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DEFAULT_EXCLUSIONS.map((pattern: string) => (
                <div
                  key={pattern}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded text-sm"
                >
                  <div className="font-mono text-gray-900 dark:text-gray-100">{pattern}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {EXCLUSION_DESCRIPTIONS[pattern]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Python venv note */}
          <div className="my-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-sm">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
              💡 Python Virtual Environments
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-200">
              Virtual environments (venv, .venv, env) are excluded by default. After restoring a backup, reinstall with:<br/>
              <code className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded">python -m venv venv && pip install -r requirements.txt</code>
            </p>
          </div>

          {/* Custom exclusions (editable) */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
              ➕ Additional Custom Exclusions (comma-separated):
            </label>
            <input
              type="text"
              value={excludeRaw}
              onChange={(e) => setExcludeRaw(e.target.value)}
              placeholder="e.g. .idea, .vscode, dist"
              className={`${inputCls} font-mono text-sm`}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              These are added to the default exclusions above
            </p>
          </div>
        </div>
      </div>

      {/* Validation result */}
      {validation && (
        <div
          className={`p-3 rounded-md text-sm ${
            validation.valid
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300'
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

      {/* ─── Schedule section ─── */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => updateSchedule({ enabled: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600 border-gray-300 dark:border-gray-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable Scheduled Backup
          </span>
        </label>

        {schedule.enabled && (
          <div className="space-y-3 pl-7">
            {/* Frequency */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-400 w-20">Frequency</label>
              <select
                value={schedule.frequency}
                onChange={(e) =>
                  updateSchedule({ frequency: e.target.value as ScheduleConfig['frequency'] })
                }
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom cron</option>
              </select>

              {/* Time picker for daily / weekly */}
              {(schedule.frequency === 'daily' ||
                schedule.frequency === 'weekly' ||
                schedule.frequency === 'monthly') && (
                <>
                  <span className="text-sm text-gray-500 dark:text-gray-400">@</span>
                  <input
                    type="time"
                    value={schedule.time}
                    onChange={(e) => updateSchedule({ time: e.target.value })}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </>
              )}

              {/* Day picker for weekly */}
              {schedule.frequency === 'weekly' && (
                <select
                  value={schedule.dayOfWeek}
                  onChange={(e) => updateSchedule({ dayOfWeek: parseInt(e.target.value) })}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DAY_NAMES.map((day, i) => (
                    <option key={day} value={i}>{day}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Custom cron expression */}
            {schedule.frequency === 'custom' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400 w-20">Cron</label>
                <input
                  type="text"
                  value={schedule.cronExpression}
                  onChange={(e) => updateSchedule({ cronExpression: e.target.value })}
                  placeholder="0 2 * * *"
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                />
              </div>
            )}

            {/* Computed cron preview */}
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              cron: {buildCronExpression(schedule)}
            </p>

            {scheduleSaved && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Schedule saved and active
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handleValidate}
          disabled={validating || !formData.sourceDir || !formData.destDir}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition"
        >
          {validating ? 'Checking...' : 'Validate Paths'}
        </button>

        <button
          type="submit"
          disabled={!isValid}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          Save Configuration
        </button>

        <button
          type="button"
          onClick={handleExecute}
          disabled={isRunning || !isValid || !isElectron}
          title={!isElectron ? 'Only available in desktop app' : ''}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isRunning ? 'Backup Running...' : 'Execute Backup Now'}
        </button>
      </div>
    </form>
  )
}
