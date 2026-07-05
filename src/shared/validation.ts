import type { RsyncConfig, ValidationResult } from '../renderer/lib/types'

const BACKUP_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const EXCLUDE_PATTERN_RE = /^[a-zA-Z0-9*./_-]+$/
const MAX_PATH_LENGTH = 4096
const MAX_EXCLUDE_PATTERNS = 50
const MAX_EXCLUDE_PATTERN_LENGTH = 256

export function validateBackupName(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Backup name is required'
  }
  if (!BACKUP_NAME_RE.test(name)) {
    return 'Backup name must be 1-64 characters: letters, numbers, underscore, hyphen'
  }
  return null
}

export function validatePathField(value: unknown, label: string): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label} is required`
  }
  if (value.length > MAX_PATH_LENGTH) {
    return `${label} exceeds maximum length (${MAX_PATH_LENGTH})`
  }
  if (value.includes('\0')) {
    return `${label} contains invalid characters`
  }
  return null
}

export function sanitizeExcludePatterns(patterns: unknown): { patterns: string[]; errors: string[] } {
  if (patterns === undefined || patterns === null) {
    return { patterns: [], errors: [] }
  }
  if (!Array.isArray(patterns)) {
    return { patterns: [], errors: ['excludePatterns must be an array'] }
  }
  const errors: string[] = []
  const valid: string[] = []
  if (patterns.length > MAX_EXCLUDE_PATTERNS) {
    errors.push(`Too many exclude patterns (max ${MAX_EXCLUDE_PATTERNS})`)
    return { patterns: [], errors }
  }
  for (const raw of patterns) {
    if (typeof raw !== 'string') {
      errors.push('Each exclude pattern must be a string')
      continue
    }
    const pattern = raw.trim()
    if (!pattern) continue
    if (pattern.length > MAX_EXCLUDE_PATTERN_LENGTH) {
      errors.push(`Exclude pattern too long: ${pattern.slice(0, 32)}...`)
      continue
    }
    if (!EXCLUDE_PATTERN_RE.test(pattern)) {
      errors.push(`Invalid exclude pattern: ${pattern}`)
      continue
    }
    valid.push(pattern)
  }
  return { patterns: valid, errors }
}

export function validateRsyncConfig(config: unknown): ValidationResult {
  const errors: string[] = []
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Invalid backup configuration'] }
  }
  const c = config as Partial<RsyncConfig>

  const nameErr = validateBackupName(c.backupName)
  if (nameErr) errors.push(nameErr)

  const sourceErr = validatePathField(c.sourceDir, 'Source directory')
  if (sourceErr) errors.push(sourceErr)

  const destErr = validatePathField(c.destDir, 'Destination directory')
  if (destErr) errors.push(destErr)

  const { errors: excludeErrors } = sanitizeExcludePatterns(c.excludePatterns)
  errors.push(...excludeErrors)

  if (c.schedule !== undefined && c.schedule !== null) {
    if (typeof c.schedule !== 'object') {
      errors.push('schedule must be an object')
    } else {
      const s = c.schedule as unknown as Record<string, unknown>
      if (typeof s.enabled !== 'boolean') errors.push('schedule.enabled must be a boolean')
      if (typeof s.cronExpression !== 'string' || !s.cronExpression.trim()) {
        errors.push('schedule.cronExpression is required')
      }
    }
  }

  return { valid: errors.length === 0, errors }
}