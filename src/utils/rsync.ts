import fs from 'fs'
import path from 'path'
import type { RsyncConfig, RsyncProgress, ValidationResult } from '../renderer/lib/types'
import { DEFAULT_EXCLUSIONS } from '../shared/constants'
import { sanitizeExcludePatterns } from '../shared/validation'

export function validatePaths(sourceDir: string, destDir: string): ValidationResult {
  const errors: string[] = []

  // Source must exist, be readable, and be a directory
  if (!fs.existsSync(sourceDir)) {
    errors.push(`Source directory does not exist: ${sourceDir}`)
  } else {
    try {
      fs.accessSync(sourceDir, fs.constants.R_OK)
      const stat = fs.statSync(sourceDir)
      if (!stat.isDirectory()) {
        errors.push(`Source path is not a directory: ${sourceDir}`)
      }
    } catch {
      errors.push(`Source directory is not readable: ${sourceDir}`)
    }
  }

  // Dest must exist (or its parent must) and be writable; existing dest must be a directory
  if (fs.existsSync(destDir)) {
    try {
      fs.accessSync(destDir, fs.constants.W_OK)
      const stat = fs.statSync(destDir)
      if (!stat.isDirectory()) {
        errors.push(`Destination path is not a directory: ${destDir}`)
      }
    } catch {
      errors.push(`Destination directory is not writable: ${destDir}`)
    }
  } else {
    const parent = path.dirname(destDir)
    if (!fs.existsSync(parent)) {
      errors.push(`Destination parent directory does not exist: ${parent}`)
    } else {
      try {
        fs.accessSync(parent, fs.constants.W_OK)
      } catch {
        errors.push(`Cannot create destination directory (parent not writable): ${parent}`)
      }
    }
  }

  const normalizedSource = path.resolve(sourceDir)
  const normalizedDest = path.resolve(destDir)

  if (normalizedSource === normalizedDest) {
    errors.push('Source and destination directories cannot be the same')
  }

  if (normalizedDest.startsWith(normalizedSource + path.sep)) {
    errors.push('Destination directory cannot be inside source directory')
  }

  if (normalizedSource.startsWith(normalizedDest + path.sep)) {
    errors.push('Source directory cannot be inside destination directory')
  }

  return { valid: errors.length === 0, errors }
}

export function buildRsyncArgs(config: RsyncConfig): string[] {
  const args: string[] = [
    '--archive',
    '--verbose',
    '--progress',
    '--stats',
    '--checksum',
    '--human-readable',
  ]

  for (const pattern of DEFAULT_EXCLUSIONS) {
    args.push(`--exclude=${pattern}`)
  }

  const { patterns: userPatterns } = sanitizeExcludePatterns(config.excludePatterns ?? [])
  for (const pattern of userPatterns) {
    if (!DEFAULT_EXCLUSIONS.includes(pattern)) {
      args.push(`--exclude=${pattern}`)
    }
  }

  const source = config.sourceDir.endsWith('/') ? config.sourceDir : `${config.sourceDir}/`
  args.push(source, config.destDir)
  return args
}

const PROGRESS_RE =
  /^\s*([\d,]+)\s+(\d+)%\s+([\d.]+\w+\/s)\s+(\d+:\d+:\d+)\s+\(xfr#(\d+),\s*to-chk=(\d+)\/(\d+)\)/
const FILES_TRANSFERRED_RE = /^Number of regular files transferred:\s*([\d,]+)/
const BYTES_TRANSFERRED_RE = /^Total transferred file size:\s*([\d,]+)/
const RSYNC_HEADER_RE = /^(sending|receiving|created|Number|Total|File|Literal|Matched|sent|total|speedup)/

export function parseLine(line: string, lastFilename: string | null): RsyncProgress | null {
  const progressMatch = line.match(PROGRESS_RE)
  if (progressMatch) {
    const [, bytes, , speed, eta, xfrNum] = progressMatch
    const filesTransferred = parseInt(xfrNum)
    return {
      status: 'syncing',
      filesTransferred,
      fileSize: parseInt(bytes.replace(/,/g, '')),
      speed,
      eta,
      currentFile: lastFilename ?? undefined,
    }
  }
  return null
}

export function parseStats(output: string): { filesChanged: number; bytesTransferred: number } {
  const filesMatch = output.match(FILES_TRANSFERRED_RE)
  const bytesMatch = output.match(BYTES_TRANSFERRED_RE)
  return {
    filesChanged: filesMatch ? parseInt(filesMatch[1].replace(/,/g, '')) : 0,
    bytesTransferred: bytesMatch ? parseInt(bytesMatch[1].replace(/,/g, '')) : 0,
  }
}

export function trackFilename(line: string): string | null {
  if (line.startsWith(' ') || RSYNC_HEADER_RE.test(line.trim())) {
    return null
  }
  const trimmed = line.trim()
  return trimmed.length > 0 ? trimmed : null
}