import fs from 'fs'
import path from 'path'
import type { RsyncConfig, RsyncProgress, ValidationResult } from '../renderer/lib/types'
import { DEFAULT_EXCLUSIONS } from '../shared/constants'

export function validatePaths(sourceDir: string, destDir: string): ValidationResult {
  const errors: string[] = []

  // Source must exist and be readable
  if (!fs.existsSync(sourceDir)) {
    errors.push(`Source directory does not exist: ${sourceDir}`)
  } else {
    try {
      fs.accessSync(sourceDir, fs.constants.R_OK)
    } catch {
      errors.push(`Source directory is not readable: ${sourceDir}`)
    }
  }

  // Dest must exist (or its parent must) and be writable
  if (fs.existsSync(destDir)) {
    try {
      fs.accessSync(destDir, fs.constants.W_OK)
    } catch {
      errors.push(`Destination directory is not writable: ${destDir}`)
    }
  } else {
    // Validate parent is writable so rsync can create destDir
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

  // Guard against source being a prefix of dest
  const normalizedSource = path.resolve(sourceDir)
  const normalizedDest = path.resolve(destDir)
  if (normalizedDest.startsWith(normalizedSource + path.sep)) {
    errors.push('Destination directory cannot be inside source directory')
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

  // Default exclusions (always applied)
  for (const pattern of DEFAULT_EXCLUSIONS) {
    args.push(`--exclude=${pattern}`)
  }

  // User-specified exclusions (in addition to defaults)
  if (config.excludePatterns) {
    for (const pattern of config.excludePatterns) {
      // Skip if it's already in defaults
      if (!DEFAULT_EXCLUSIONS.includes(pattern)) {
        args.push(`--exclude=${pattern}`)
      }
    }
  }

  // Trailing slash semantics: copies CONTENTS of sourceDir into destDir
  const source = config.sourceDir.endsWith('/') ? config.sourceDir : `${config.sourceDir}/`

  args.push(source, config.destDir)
  return args
}

// Regex patterns for rsync output parsing
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
  // A filename line has no leading whitespace and isn't an rsync header
  if (line.startsWith(' ') || RSYNC_HEADER_RE.test(line.trim())) {
    return null
  }
  const trimmed = line.trim()
  return trimmed.length > 0 ? trimmed : null
}
