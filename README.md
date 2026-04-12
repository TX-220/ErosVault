# Replicant

> **Perfect file replication. Incremental backup with zero dialogs.**

Replicant is a desktop application for automated incremental file backup using rsync. Built with Electron and Next.js 14, it provides a modern UI for managing backups with real-time progress, scheduling, and history tracking.

Inspired by Blade Runner's relentless pursuit of perfection.

## Features

- ✅ **Incremental Backups** — Only changed files are synced using rsync
- ✅ **Real-Time Progress** — Watch files transferred, speed, and ETA live
- ✅ **Backup History** — Persistent log of all backup operations
- ✅ **Scheduled Backups** — Daily, weekly, or custom cron-based automation
- ✅ **Path Validation** — Verify source/destination accessibility before backup
- ✅ **Dark Mode** — Light and dark theme toggle
- ✅ **Cross-Platform** — Linux, macOS, Windows (via WSL2)
- ✅ **Auto-Restore** — systemd or cron auto-start on system boot

## Architecture

```
User Input (UI)
  ↓
Validate Paths (backend)
  ↓
Execute rsync (spawned process)
  ↓
Stream stdout/stderr (real-time UI update)
  ↓
Log Result (JSON file or SQLite)
  ↓
UI Display (history, stats)
```

### Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, Zustand
- **Backend**: Electron (Node.js), TypeScript, node-cron
- **Build**: Electron Builder, webpack, esbuild
- **Process Management**: rsync, child_process, systemd/cron

## Installation

### Prerequisites

- Node.js 18+
- rsync (install via `apt install rsync` on Ubuntu/Debian, `brew install rsync` on macOS)
- npm or pnpm

### Setup

```bash
git clone https://github.com/yourusername/replicant.git
cd replicant
npm install
```

## Usage

### Development Mode

```bash
npm run dev
```

Starts:
- Next.js dev server on `http://localhost:3002`
- Electron window with hot reload
- TypeScript compilation in watch mode

### Production Build

```bash
npm run build
npm run dist
```

Generates platform-specific installers:
- Linux: `.AppImage`
- macOS: `.dmg`
- Windows: `.exe` (or `.msi`)

### Running the Packaged App

```bash
npm start
```

Launches Electron with the compiled app.

## Quick Start

1. **Configure a backup**:
   - Open app → **Configure** tab
   - Set source directory (e.g., `/home/user/my-project`)
   - Set destination directory (e.g., `/mnt/usb/backup`)
   - Click **"Validate Paths"** to verify

2. **Execute backup**:
   - Click **"Execute Backup Now"**
   - Watch real-time progress (files, speed, ETA)
   - Result logged automatically

3. **Schedule backups** (optional):
   - Enable **"Schedule Enabled"** checkbox
   - Choose frequency: Daily, Weekly, or Custom cron
   - Set time and save
   - Backups run automatically in the background

4. **View history**:
   - Click **History** tab
   - See all past backups with timestamps, file counts, and duration

## Directory Structure

```
replicant/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── main.ts           # Entry point
│   │   ├── ipc.ts            # IPC handlers (rsync execution)
│   │   ├── preload.ts        # Context bridge
│   │   └── scheduler.ts      # Cron scheduler
│   ├── renderer/              # Next.js frontend
│   │   ├── pages/            # Next.js pages
│   │   │   ├── index.tsx     # Dashboard
│   │   │   ├── configure.tsx # Configuration
│   │   │   └── history.tsx   # History viewer
│   │   ├── components/       # React components
│   │   │   ├── Layout.tsx
│   │   │   ├── BackupForm.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── HistoryTable.tsx
│   │   ├── lib/              # Utilities & state
│   │   │   ├── store.ts      # Zustand store
│   │   │   ├── types.ts      # TypeScript interfaces
│   │   │   ├── electron-mock.ts
│   │   │   └── electron.d.ts
│   │   └── styles/           # TailwindCSS
│   └── utils/                # Shared utilities
│       └── rsync.ts          # rsync wrapper & parsing
├── pages/                    # Root pages (Next.js routing)
├── .github/
│   └── workflows/
│       └── ci.yml            # CI/CD pipeline
├── public/                   # Assets
├── package.json              # Dependencies & scripts
├── tsconfig.json             # Renderer tsconfig
├── tsconfig.electron.json    # Main tsconfig
├── next.config.js            # Next.js config
├── tailwind.config.ts        # TailwindCSS config
├── postcss.config.js         # PostCSS config
├── LICENSE                   # MIT License
├── README.md                 # This file
└── .gitignore
```

## IPC API

The app uses Electron IPC for bi-directional communication between main and renderer processes.

### `backup:execute`

Execute an incremental backup using rsync.

**Request**:
```typescript
{
  sourceDir: string
  destDir: string
  backupName: string
  excludePatterns?: string[]
  schedule?: ScheduleConfig
}
```

**Response** (streaming then final):
```typescript
// Progress events (streamed):
{ status: 'validating' | 'syncing', filesTransferred?, speed?, eta?, currentFile? }

// Final result:
{ 
  status: 'complete' | 'error'
  message: string
  timestamp: ISO8601
  filesChanged: number
  bytesTransferred: number
  duration: number
}
```

### `backup:validate-paths`

Validate source and destination directories.

**Request**: `{ sourceDir, destDir }`

**Response**: `{ valid: boolean, errors: string[] }`

### `backup:get-history`

Get all backup history records.

**Response**: `BackupRecord[]`

### `backup:cancel`

Cancel an active backup.

**Request**: `backupName`

**Response**: `{ success: boolean }`

### `backup:schedule`

Configure scheduled backups (cron-based).

**Request**: `{ enabled: boolean, cronExpression: string, backupConfig }`

**Response**: `{ success: boolean, message: string }`

## Data Persistence

- **History**: `~/.backup-app/history.json` (capped at 500 records)
- **Configuration**: Stored in Zustand state (no disk persistence between sessions)

## Troubleshooting

### rsync not found error

Install rsync:
```bash
# Ubuntu/Debian
sudo apt install rsync

# macOS
brew install rsync

# Windows (WSL2)
apt install rsync  # inside WSL2 Ubuntu
```

### Destination not writable error

Check permissions:
```bash
ls -ld /mnt/backup
sudo mount -o remount,rw /mnt/backup
```

### App won't start on reboot

The app auto-starts via cron `@reboot` entry. Check:
```bash
crontab -l | grep backup-app
cat /tmp/backup-app.log
```

## Development

### Type Checking

```bash
npm run typecheck
```

Checks both renderer and main process TypeScript.

### Build Only (No Electron)

```bash
next build
tsc -p tsconfig.electron.json
```

### Debug Mode

Open DevTools in Electron:
- Press `Ctrl+Shift+I` (or `Cmd+Option+I` on macOS)

### Testing

Manual testing with real rsync:
1. Create test source: `mkdir -p /tmp/test-src && echo "test" > /tmp/test-src/file.txt`
2. Start app: `npm run dev`
3. Configure: Source `/tmp/test-src`, Destination `/tmp/test-dst`
4. Execute backup and verify `/tmp/test-dst/file.txt` exists

## Performance

- Electron: ~200MB memory footprint
- rsync subprocess: Depends on file count/size
- Real-time progress updates: ~1 per second
- History lookup: O(1) in-memory

## Security

- ✅ No hardcoded secrets
- ✅ No credential storage
- ✅ Local file paths only
- ✅ Context isolation enabled (Electron)
- ✅ No Node.js access in renderer

## Future Enhancements

- [ ] Encryption support (EncFS integration)
- [ ] Cloud backup targets (S3, Google Drive)
- [ ] Email notifications on backup completion
- [ ] Backup compression and deduplication
- [ ] Network backup (SSH/SMB targets)
- [ ] Bandwidth throttling
- [ ] Dry-run mode

## License

MIT License © 2026 Replicant Contributors

See [LICENSE](./LICENSE) for full text.

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

Found a bug? Have a feature request?

- GitHub Issues: https://github.com/yourusername/replicant/issues
- Discussions: https://github.com/yourusername/replicant/discussions

---

**Replicant** — *Perfect replication. Every time.*
