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
  'venv',           // Python virtual environment
  '.venv',          // Python virtual environment
  'env',            // Python virtual environment
  '__pycache__',    // Python compiled bytecode
  '*.pyc',          // Python compiled files
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
  'venv': 'Python virtual environment — reinstall with: python -m venv venv && pip install -r requirements.txt',
  '.venv': 'Python virtual environment — reinstall with: python -m venv .venv && pip install -r requirements.txt',
  'env': 'Python virtual environment — reinstall with: python -m venv env && pip install -r requirements.txt',
  '__pycache__': 'Python bytecode cache — regenerates automatically',
  '*.pyc': 'Python compiled files — regenerates automatically',
}
