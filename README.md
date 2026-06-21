# Replicant

> **Perfect file replication. Incremental backup with zero dialogs.**

A minimal, elegant desktop backup application that uses rsync for reliable incremental file synchronization. Configure once, backup forever.

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## Features

✨ **Core Features**
- **Incremental Sync**: Only transfers changed files using rsync's algorithm
- **Real-Time Progress**: Live file transfer status, speed, ETA
- **Backup History**: Complete audit trail of all backups with timestamps and file counts
- **Scheduled Backups**: Daily, weekly, monthly, or custom cron schedules
- **Zero Dialogs**: Set it once, it just works
- **Smart Exclusions**: Automatically excludes node_modules, .git, .next, logs, and build artifacts
- **Dark Mode**: Native dark/light theme toggle

🚀 **Technical Highlights**
- Built with **Electron + Next.js 14** for desktop + web capabilities
- **TypeScript** for type safety across main and renderer processes
- **IPC Bridge** for secure process communication
- **Zustand** for lightweight state management
- **Tailwind CSS** for responsive UI
- **node-cron** for reliable scheduling

## Installation

### Requirements
- Node.js 18+ (recommended 20.x)
- pnpm (or npm/yarn)
- rsync (included on macOS/Linux; Windows bundled with app)

### Setup

```bash
# Clone repository
git clone https://github.com/TX-220/replicant.git
cd replicant

# Install dependencies
pnpm install

# Development: Run in dev mode
pnpm dev

# Production: Build and package
pnpm dist
```

## Quick Start

After installation, launch the app with a single command:

```bash
replicant
```

That's it. The Electron desktop window opens with the full backup interface ready to use.

## Usage

### 1. Configure Backup
1. Open **Configure** tab
2. Set backup name, source directory, destination directory
3. Review default exclusions (node_modules, .git, .cache, .env.local, etc.)
4. Add custom exclusions if needed (comma-separated)
5. Click **Save Configuration**

### 2. Execute Backup
1. Click **Execute Backup Now** to start immediately
2. Watch real-time progress: files transferred, speed, ETA
3. Backup completes and is logged to history

### 3. View History
1. Open **History** tab
2. See all past backups with timestamps, file counts, durations
3. Status indicators show success/error for each backup

### 4. Schedule Backups
1. Open **Configure** tab
2. Enable **Scheduled Backup**
3. Choose frequency: Daily, Weekly, Monthly, or Custom cron
4. Set time and day (if applicable)
5. Click **Save Configuration**
6. View all active schedules in **Schedules** tab

## Project Structure

```
replicant/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Entry point
│   │   ├── ipc.ts         # IPC handlers (backup execution)
│   │   ├── scheduler.ts   # Schedule management
│   │   └── preload.ts     # Context bridge
│   ├── renderer/          # Next.js frontend
│   │   ├── pages/         # Page routes
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities, store, types
│   ├── utils/             # Shared utilities
│   │   └── rsync.ts       # Rsync wrapper, path validation
│   └── shared/            # Shared constants
│       └── constants.ts   # Default exclusions
├── public/                # Static assets
├── package.json
├── tsconfig.json          # Renderer TypeScript config
├── tsconfig.electron.json # Main process TypeScript config
└── next.config.js         # Next.js configuration
```

## Smart Exclusions

### Default Patterns

Replicant automatically excludes patterns that shouldn't be backed up:
- **Node.js**: `node_modules/` (reinstall with `npm install`)
- **Python**: `venv/`, `.venv/`, `env/`, `__pycache__/`, `*.pyc` (reinstall with `python -m venv`)
- **Build output**: `.next/`, `dist/`, `build/`
- **System files**: `.git/`, `.DS_Store`, `.env.local`, `*.log`, `.cache/`

**Note**: Python virtual environments are excluded by default. They regenerate automatically after backup restore — just reinstall dependencies with `pip install -r requirements.txt`.

## Development

### Build for Development
```bash
pnpm dev
```

### Type Checking
```bash
npx tsc --noEmit                              # Renderer
npx tsc -p tsconfig.electron.json --noEmit    # Main process
```

### Build for Production
```bash
pnpm build                    # Compile TS + build Next.js
pnpm dist                     # Package Electron app
```

## Author

TX-220 — Concept, design, direction. Claude (Anthropic) — Implementation. [Claude Code](https://claude.com/claude-code) — Development.

## License

MIT — See [LICENSE](LICENSE) file for details.

---

Built with ⚡ [Claude Code](https://claude.com/claude-code)

This was an experimental project developed with Claude (Haiku). Later improved significantly with Grok.