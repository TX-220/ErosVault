export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface ScheduleConfig {
  enabled: boolean
  frequency: ScheduleFrequency
  time: string        // "HH:MM" for daily/weekly
  dayOfWeek: number   // 0 = Sun … 6 = Sat (used for weekly)
  cronExpression: string // computed for daily/weekly, user-entered for custom
}

export interface RsyncConfig {
  sourceDir: string
  destDir: string
  backupName: string
  excludePatterns?: string[]
  schedule?: ScheduleConfig
}

export interface RsyncProgress {
  status: 'validating' | 'syncing' | 'complete' | 'error' | 'cancelled'
  filesTransferred?: number
  fileSize?: number
  speed?: string
  eta?: string
  currentFile?: string
  message?: string
}

export interface RsyncResult {
  status: 'complete' | 'error' | 'cancelled'
  message: string
  timestamp: string
  filesChanged: number
  bytesTransferred: number
  duration: number
}

export interface BackupRecord extends RsyncResult {
  id: string
  backupName: string
  sourceDir: string
  destDir: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export interface ScheduleRecord {
  id: string
  backupName: string
  cronExpression: string
  enabled: boolean
  frequency: ScheduleFrequency
  time: string
  dayOfWeek: number
  backupConfig: RsyncConfig
  createdAt: string
  lastRun?: string
  lastStatus?: 'complete' | 'error'
  nextRun?: string
}
