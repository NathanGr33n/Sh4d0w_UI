# Terminal Session Persistence

## Overview

Shadow UI now automatically saves and restores your terminal sessions across app restarts. When you close the application, your working directory, terminal size, and shell configuration are preserved and restored the next time you launch the app.

## Features

### Automatic Session Saving
- **Working Directory**: The current working directory is saved when the app closes
- **Shell Type**: Your shell preference (PowerShell, bash, zsh, etc.) is remembered
- **Terminal Size**: Terminal dimensions (columns & rows) are preserved
- **Session History**: The last 10 terminal sessions are kept for reference

### Automatic Session Restoration
- **Smart Fallback**: If a saved directory no longer exists, Shadow UI falls back to your home directory
- **Validation**: All saved data is validated and sanitized for security
- **Seamless Experience**: Sessions restore automatically on app launch

## How It Works

### Session Storage
Sessions are stored using `electron-store` in a secure, per-user location:
- **Windows**: `%APPDATA%\ShadowUI\terminal-sessions.json`
- **macOS**: `~/Library/Application Support/ShadowUI/terminal-sessions.json`
- **Linux**: `~/.config/ShadowUI/terminal-sessions.json`

### What Gets Saved

Each session includes:
```javascript
{
  cwd: "/path/to/working/directory",
  shell: "powershell.exe",  // or bash, zsh, etc.
  cols: 120,                 // terminal columns
  rows: 32,                  // terminal rows
  timestamp: 1701234567890   // when session was saved
}
```

### Security Features

#### Path Sanitization
- Paths are validated and normalized
- Path traversal attempts (e.g., `../../../etc/passwd`) are blocked
- Non-existent directories fall back to home directory

#### Shell Whitelist
Only trusted shells are allowed:
- **Windows**: `powershell.exe`, `pwsh.exe`, `cmd.exe`
- **Unix/Linux**: `bash`, `zsh`, `fish`, `sh`, `/bin/bash`, `/bin/zsh`, `/bin/fish`, `/bin/sh`

Any shell not in the whitelist is replaced with the system default.

#### Dimension Validation
Terminal dimensions are clamped to safe ranges:
- **Columns**: 1-500 (default: 80)
- **Rows**: 1-200 (default: 24)

Invalid values are replaced with defaults to prevent resource exhaustion.

## Usage

### Normal Operation
Terminal sessions are automatically saved and restored—no user action required!

1. **Open Shadow UI** and work in your terminal
2. **Navigate to any directory** using `cd` commands
3. **Close the app** - your session is automatically saved
4. **Reopen Shadow UI** - you're back where you left off!

### Manual Session Management

While sessions are managed automatically, you can interact with the session manager programmatically:

```javascript
const SessionManager = require('./sessionManager');
const sessionManager = new SessionManager(logger);

// Manually save a session
sessionManager.saveSession({
  cwd: '/home/user/projects',
  shell: 'bash',
  cols: 120,
  rows: 32
});

// Load the last session
const session = sessionManager.loadLastSession();
console.log('Restoring:', session.cwd);

// Get all saved sessions
const allSessions = sessionManager.getAllSessions();
console.log('History:', allSessions);

// Clear old sessions (older than 30 days)
sessionManager.clearOldSessions(30);

// Clear all sessions
sessionManager.clearSessions();
```

## Implementation Details

### Architecture

The session persistence system consists of three main components:

1. **SessionManager** (`sessionManager.js`)
   - Core module for saving/loading session data
   - Handles validation, sanitization, and storage
   - Provides session history management

2. **Main Process Integration** (`main.js`)
   - Saves current session during cleanup/shutdown
   - Restores session on terminal initialization
   - Tracks session state changes (resize, etc.)

3. **Storage Layer** (`electron-store`)
   - Persists session data to disk
   - Provides atomic reads/writes
   - Handles platform-specific storage paths

### Session Lifecycle

```
App Start
  ↓
Load Last Session
  ↓
Initialize Terminal
  ├─ Restore CWD
  ├─ Restore Shell
  └─ Restore Size
  ↓
[User Works in Terminal]
  ↓
App Close/Cleanup
  ↓
Save Current Session
  ↓
App Exit
```

### Code Integration Points

#### Cleanup Hook (main.js:218-225)
```javascript
// Save terminal session before cleanup
if (sessionManager && shellPty) {
  try {
    sessionManager.saveSession(currentSession);
  } catch (err) {
    log.error('Failed to save terminal session:', err);
  }
}
```

#### Terminal Init Hook (main.js:333-347)
```javascript
// Try to restore previous session
const savedSession = sessionManager.loadLastSession();

const validSize = validateSize(size);
const cols = validSize ? size.cols : savedSession?.cols || 120;
const rows = validSize ? size.rows : savedSession?.rows || 32;
const cwd = savedSession?.cwd || null;
const shell = savedSession?.shell || null;

if (savedSession) {
  log.info('Restoring previous terminal session');
}

startShell(cols, rows, cwd, shell);
```

#### Resize Tracking (main.js:357-360)
```javascript
shellPty.resize(size.cols, size.rows);
// Update session state
currentSession.cols = size.cols;
currentSession.rows = size.rows;
```

## Testing

The session persistence system includes comprehensive tests covering:

### Functional Tests (18 tests)
- Session save/load operations
- Default value handling
- Session history management
- Directory validation and fallback

### Security Tests
- Path traversal protection
- Shell whitelist enforcement
- Dimension bounds validation
- Invalid input handling

### Run Tests
```bash
npm test -- sessionManager.test.js
```

## Troubleshooting

### Session Not Restoring

**Issue**: Terminal opens in wrong directory after restart

**Solutions**:
1. Check that the saved directory still exists
2. Verify you have read permissions for the saved directory
3. Check logs for session load errors: `%APPDATA%\ShadowUI\logs\`

### Wrong Shell Being Used

**Issue**: Terminal opens with different shell than expected

**Solutions**:
1. Verify your shell is in the whitelist (see Security Features above)
2. Check system default shell: `echo $SHELL` (Unix) or `$PSVersionTable` (Windows)
3. Shell must be in system PATH

### Session Data Location

To manually inspect or clear session data:

**Windows**:
```powershell
notepad $env:APPDATA\ShadowUI\terminal-sessions.json
```

**macOS/Linux**:
```bash
cat ~/Library/Application\ Support/ShadowUI/terminal-sessions.json  # macOS
cat ~/.config/ShadowUI/terminal-sessions.json  # Linux
```

### Clear All Sessions

If you want to start fresh:

**Windows**:
```powershell
Remove-Item $env:APPDATA\ShadowUI\terminal-sessions.json
```

**macOS/Linux**:
```bash
rm ~/Library/Application\ Support/ShadowUI/terminal-sessions.json  # macOS
rm ~/.config/ShadowUI/terminal-sessions.json  # Linux
```

## Privacy & Data

### What's Stored
- Directory paths you've navigated to
- Terminal dimensions
- Shell preference
- Session timestamps

### What's NOT Stored
- Terminal command history (handled by your shell)
- Terminal output or scrollback buffer
- Environment variables
- Credentials or secrets

### Data Retention
- Last 10 sessions are kept in history
- Old sessions can be auto-cleared (default: 30 days)
- All session data is stored locally, never transmitted

## Future Enhancements

Potential improvements for future versions:

- [ ] Multiple terminal tabs/sessions
- [ ] Named session profiles
- [ ] Session import/export
- [ ] Scrollback buffer persistence
- [ ] Command history sync across sessions
- [ ] Environment variable preservation (securely)

## Related Documentation

- [SECURITY_FIXES_COMPLETED.md](./SECURITY_FIXES_COMPLETED.md) - Security improvements
- [TESTING.md](./TESTING.md) - Testing guidelines
- [ROADMAP.md](../ROADMAP.md) - Feature roadmap

## Questions or Issues?

If you encounter any issues with terminal session persistence:

1. Check the troubleshooting section above
2. Review logs in `%APPDATA%\ShadowUI\logs\` (Windows) or `~/.config/ShadowUI/logs/` (Unix)
3. File an issue on GitHub with:
   - OS and version
   - Shell type
   - Steps to reproduce
   - Relevant log excerpts

---

**Version**: 0.2.0  
**Last Updated**: 2025-11-29  
**Feature Status**: ✅ Implemented & Tested
