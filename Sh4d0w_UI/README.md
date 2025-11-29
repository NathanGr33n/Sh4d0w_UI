# Shadow UI - Development Guide

**Version 0.2.0** - A security-hardened, TypeScript-enabled Electron terminal dashboard

## Quick Start

### Development Mode
```powershell
npm run build  # Compile TypeScript
npm start      # Launch application
```

### Testing
```powershell
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Code Quality
```powershell
npm run lint          # Check code
npm run lint:fix      # Auto-fix issues
npm run format        # Format with Prettier
npm run typecheck     # TypeScript validation
```

### Building
```powershell
npm run pack  # Package for current platform
npm run dist  # Create distributable
```

## Fresh Install (If Issues Occur)
```powershell
rmdir /s /q node_modules 2>$null
del package-lock.json yarn.lock pnpm-lock.yaml 2>$null
npm install
npm run build
npm start
```

## Architecture

- **main.js**: Main Electron process with security hardening
- **sessionManager.js**: Terminal session persistence
- **config.ts**: Type-safe configuration system
- **logger.js**: Advanced logging with rotation
- **errorHandler.js**: Centralized error management
- **preload.js**: Secure IPC bridge
- **renderer/**: UI components and terminal integration

## Security Features

- Content Security Policy with SRI hashes
- IPC rate limiting (DoS protection)
- Environment variable sanitization
- Terminal escape sequence filtering
- Debug commands restricted to development
- Input validation and bounds checking

## Documentation

- [TERMINAL_SESSIONS.md](./TERMINAL_SESSIONS.md) - Session persistence
- [SECURITY_FIXES_COMPLETED.md](./SECURITY_FIXES_COMPLETED.md) - Security improvements
- [TESTING.md](./TESTING.md) - Testing guidelines
- [LINTING.md](./LINTING.md) - Code style guide
- [TYPESCRIPT.md](./TYPESCRIPT.md) - TypeScript usage

## Requirements

- Node.js 18 LTS or higher (Node 20 LTS recommended)
- npm latest version
- Windows 10+, macOS 10.14+, or modern Linux

If prebuilds don't match your Node/Electron ABI, install **Node 20 LTS** and try again.
