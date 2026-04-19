// Default exclusions applied to all backups
export const DEFAULT_EXCLUSIONS = [
  'node_modules',   // npm dependencies — reinstall via npm install
  '.git',           // version control metadata
  '.next',          // Next.js build output
  'dist',           // build output directory
  'build',          // build output directory
  '.cache',         // various cache directories
  '.DS_Store',      // macOS metadata
  '*.log',          // log files
  'tmp',            // temporary files
  '.env.local',     // local environment secrets
]

export const EXCLUSION_DESCRIPTIONS: Record<string, string> = {
  'node_modules': 'npm dependencies — reinstall with: npm install',
  '.git': 'version control metadata',
  '.next': 'Next.js build output',
  'dist': 'build output directory',
  'build': 'build output directory',
  '.cache': 'various cache directories',
  '.DS_Store': 'macOS system metadata',
  '*.log': 'log files',
  'tmp': 'temporary files',
  '.env.local': 'local environment secrets',
}
