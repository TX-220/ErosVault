import { spawn, ChildProcess } from 'child_process'
import type { RsyncConfig, RsyncProgress } from '../renderer/lib/types'
import { buildRsyncArgs, parseLine, parseStats, trackFilename } from '../utils/rsync'

export interface RsyncRunResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  stats: { filesChanged: number; bytesTransferred: number }
  cancelled: boolean
}

export interface RsyncProcessOptions {
  config: RsyncConfig
  onProgress?: (progress: RsyncProgress) => void
  isCancelled?: () => boolean
}

export function spawnRsyncProcess(options: RsyncProcessOptions): ChildProcess {
  const args = buildRsyncArgs(options.config)
  return spawn('rsync', args, { stdio: ['ignore', 'pipe', 'pipe'] })
}

export function attachRsyncListeners(
  proc: ChildProcess,
  options: RsyncProcessOptions
): Promise<RsyncRunResult> {
  return new Promise((resolve) => {
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let lastFilename: string | null = null

    const stdout = proc.stdout
    const stderr = proc.stderr

    if (stdout) {
      stdout.setEncoding('utf-8')
      stdout.on('data', (chunk: string) => {
        stdoutBuffer += chunk
        const lines = stdoutBuffer.split('\n')
        stdoutBuffer = lines.pop() ?? ''
        for (const line of lines) {
          const filename = trackFilename(line)
          if (filename) lastFilename = filename
          const progress = parseLine(line, lastFilename)
          if (progress && options.onProgress) {
            options.onProgress(progress)
          }
        }
      })
    }

    if (stderr) {
      stderr.setEncoding('utf-8')
      stderr.on('data', (chunk: string) => {
        stderrBuffer += chunk
      })
    }

    proc.on('close', (exitCode, signal) => {
      const fullOutput = stdoutBuffer + '\n' + stderrBuffer
      resolve({
        exitCode,
        signal,
        stdout: fullOutput,
        stderr: stderrBuffer,
        stats: parseStats(fullOutput),
        cancelled:
          (options.isCancelled?.() ?? false) || signal === 'SIGTERM' || signal === 'SIGKILL',
      })
    })

    proc.on('error', (err) => {
      resolve({
        exitCode: null,
        signal: null,
        stdout: stdoutBuffer,
        stderr: err.message.includes('ENOENT')
          ? 'rsync is not installed or not found in PATH'
          : err.message,
        stats: { filesChanged: 0, bytesTransferred: 0 },
        cancelled: false,
      })
    })
  })
}