type RunKind = 'manual' | 'scheduled'

const activeRuns = new Map<string, RunKind>()

export function tryAcquireRun(backupName: string, kind: RunKind): boolean {
  if (activeRuns.has(backupName)) return false
  activeRuns.set(backupName, kind)
  return true
}

export function releaseRun(backupName: string): void {
  activeRuns.delete(backupName)
}

export function isRunActive(backupName: string): boolean {
  return activeRuns.has(backupName)
}

export function getActiveRunKind(backupName: string): RunKind | undefined {
  return activeRuns.get(backupName)
}