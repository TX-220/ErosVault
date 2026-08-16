# ErosVault

> **COSMIC BACKUP · EMPRESS EDITION**  
> Perfect incremental file replication. Zero dialogs. Set it once — it just works.

Dark nebula / rose-magenta desktop vault for reliable **rsync** backups.  
Formerly *Replicant* (Blade Runner–era name retired).

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

**Repo:** https://github.com/TX-220/ErosVault  

Local clone path may still be `~/projects/replicant` on some machines (systemd / launcher compatibility). Runtime data dir remains `~/.backup-app`.

---

## What it is

ErosVault is a **cosmic empress-themed** Electron + Next.js app that runs **incremental rsync** backups with:

- Real-time progress (files, speed, ETA)
- Full backup history
- Schedules (daily / weekly / monthly / custom cron)
- Smart exclusions (`node_modules`, `.git`, venvs, build artifacts, …)
- Zero nagging dialogs after first setup

---

## Features

✨ **Core**
- **Incremental sync** — only changed files (rsync)
- **Live progress** — transfer status, speed, ETA
- **History** — timestamps, file counts, success/error
- **Scheduled backups** — cron-style scheduling
- **Zero dialogs** — configure once, backup forever
- **Smart exclusions** — sane defaults + custom patterns
- **Cosmic UI** — void / nebula / rose (EMPRESS EDITION)

🚀 **Stack**
- **Electron + Next.js 14**
- **TypeScript** (main + renderer)
- **IPC** bridge, **Zustand**, **Tailwind**
- **node-cron** scheduling (+ optional headless daemon)

---

## Installation

### Requirements
- Node.js **22.12+** (Electron 41)
- **pnpm** (recommended)
- **rsync** (macOS/Linux; Windows may bundle/path as needed)

### Setup

```bash
git clone https://github.com/TX-220/ErosVault.git
cd ErosVault

pnpm install

# Development
pnpm dev

# Production package
pnpm dist
```

> **Rename note:** GitHub redirects `TX-220/replicant` → `TX-220/ErosVault`.

### Launch (if installed on PATH)

```bash
replicant    # legacy launcher name still OK
# optional alias: erosvault
```

---

## Quick usage

1. **Configure** — name, source, destination, exclusions → Save  
2. **Execute Backup Now** — watch progress  
3. **History** — audit past runs  
4. **Schedule** — daily/weekly/monthly/custom cron → Schedules tab  

---

## Project structure

```
ErosVault/   (local dir may be named replicant)
├── src/
│   ├── main/              # Electron main (window, IPC, scheduler)
│   ├── renderer/          # Next.js UI (cosmic theme)
│   ├── headless/          # Optional headless schedule daemon
│   ├── utils/             # rsync wrapper, path validation
│   └── shared/            # defaults (exclusions, …)
├── public/
├── package.json           # productName: ErosVault
└── …
```

---

## Smart exclusions (defaults)

- **Node:** `node_modules/`
- **Python:** `venv/`, `.venv/`, `__pycache__/`, `*.pyc`
- **Build:** `.next/`, `dist/`, `build/`
- **System/secrets-ish:** `.git/`, `.DS_Store`, `.env.local`, `*.log`, `.cache/`

Reinstall dependencies after restore; venvs are not meant to travel.

---

## Development

```bash
pnpm dev
pnpm typecheck
pnpm build
pnpm dist
```

---

## Recent updates

**2026-08** — **ErosVault · COSMIC BACKUP · EMPRESS EDITION** public rebrand.

- Product name / window title / appId → **ErosVault**
- Cosmic UI (void / nebula / rose-magenta)
- Headless daemon path for scheduled P0-style runs (unit names may stay legacy)
- Public repo rename from `replicant`

**2026-07-05** — Reliability & CI hardening (schedules after restart, path validation, config persistence, Linux dev launch).

---

## Author

TX-220 — Concept, design, direction.  
Claude (Anthropic) — Implementation.  
[Claude Code](https://claude.com/claude-code) & [Grok](https://x.ai) — Development and debug.

## License

MIT — See [LICENSE](LICENSE).

---

**ErosVault** · COSMIC BACKUP · EMPRESS EDITION ⚡
