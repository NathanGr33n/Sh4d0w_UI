# lite_ui
Custom UI Application by NathanGr33n

A lightweight, edex_ui-inspired sci‑fi terminal dashboard built with Electron + xterm.js + node-pty + systeminformation.

## Features
- Live terminal backed by your system shell (bash/zsh/pwsh) via `node-pty`
- Real-time system stats: CPU load, memory, network throughput, disk usage, temperature/battery (when available)
- Responsive neon UI with edex-style panels

## Prereqs
- Node.js 18+ and npm
- macOS, Linux, or Windows

## Quick Start
```bash
npm install
npm start
```

## Packaging
```bash
npm run dist
```

## Notes
- On Linux you may need additional packages for pty support: `build-essential` and Python for native modules.
- On Windows, if build tools are required, install: `npm install --global --production windows-build-tools` (elevated PowerShell).
- If fonts look cramped, tweak `fontSize` and container sizing in `renderer.js`.
