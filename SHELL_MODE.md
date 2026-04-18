# Shadow UI — Shell Mode

This document describes how Shadow UI can run as a *true* Windows shell, i.e. in place of `explorer.exe`, for the current user.

> **Heads-up.** Replacing the Windows shell is a high-risk operation. Always test on a disposable user account or VM first. Every install/uninstall flow in Shadow UI is per-user (HKCU) and requires no administrative privileges.

## Architecture overview

```
              Win Logon
                 │
                 ▼
      HKCU\…\Winlogon\Shell  ─────▶  ShadowUI-Watchdog.exe
                                         │
                                         │ spawns / supervises
                                         ▼
                                   Shadow UI.exe --shell
                                         │
                                         ├── Kiosk BrowserWindow
                                         ├── shell/shellMode.js
                                         ├── shell/processLauncher.js  (run apps)
                                         ├── shell/startMenu.js        (enumerate .lnk)
                                         ├── shell/windowManager.js    (list/focus windows)
                                         └── shell/sessionControl.js   (power controls)
```

- The **watchdog** is the process registered as the shell. If Shadow UI crashes it restarts it (up to `watchdogRetries` times within a sliding window). If the budget is exhausted the watchdog falls back to `explorer.exe` so the user always has a shell.
- The **main process** branches on `--shell` / `SHADOW_UI_SHELL=1` / `config.shell.enabled`. When shell mode is active it builds a kiosk `BrowserWindow`, loads `renderer/shell/index.html`, and registers the shell IPC surface.
- The **shell IPC surface** is gated on shell mode so the normal app has exactly zero extra attack surface.
- The **panic hotkey** (`Ctrl+Alt+Shift+E` by default) is registered via `globalShortcut` and always spawns `explorer.exe`, so the user is never trapped inside a frozen shell.

## Files
- `Sh4d0w_UI/shell/shellMode.js` — mode detection + kiosk window config.
- `Sh4d0w_UI/shell/processLauncher.js` — safe `spawn`-based launcher.
- `Sh4d0w_UI/shell/startMenu.js` — `.lnk` enumerator with TTL cache.
- `Sh4d0w_UI/shell/windowManager.js` — PowerShell-backed window list/focus.
- `Sh4d0w_UI/shell/sessionControl.js` — logoff / restart / shutdown / lock.
- `Sh4d0w_UI/shell/watchdog.js` — supervisor. Use this as the registered shell.
- `Sh4d0w_UI/scripts/install-shell.ps1` — sets HKCU shell.
- `Sh4d0w_UI/scripts/uninstall-shell.ps1` — restores the previous shell.
- `Sh4d0w_UI/scripts/recovery-explorer.ps1` — emergency `explorer.exe` launcher.
- `Sh4d0w_UI/renderer/shell/` — kiosk renderer (HTML / CSS / JS).
- `Sh4d0w_UI/build/installer.nsh` — NSIS customizations (adds Start-Menu shortcuts only).

## Configuration
The `shell` section of `~/.shadow-ui-config.json` (managed by `config.ts`):

```
{
  "shell": {
    "enabled": false,              // force shell mode without --shell
    "launchOnStartup": true,       // watchdog restarts the app on crash
    "panicHotkey": "Control+Alt+Shift+E",
    "watchdogRetries": 5,
    "watchdogWindowMs": 60000,     // sliding window for retry budget
    "fallbackToExplorer": true,    // spawn explorer.exe after budget exhausted
    "startMenuCacheMs": 30000      // TTL for the Start Menu scan
  }
}
```

Values are validated by the same schema used for the rest of the config (`config.ts`).

## Quick start (development)
```
cd Sh4d0w_UI
npm install
npm run shell:start
```

This launches Shadow UI with `--shell`. The Windows shell is **not** modified; only the kiosk UI is shown in an Electron window.

Hit **Ctrl+Alt+Shift+E** at any time to spawn `explorer.exe`.

## Production install (opt-in per user)
1. Build the app: `npm run dist` — produces an NSIS installer under `release/`.
2. Install as a normal (non-elevated) user.
3. Optional: open **Start Menu → Shadow UI → Shell Mode → Launch Shadow UI (Shell Mode)** to verify the kiosk UI works on your account.
4. Only when you are satisfied, use **Start Menu → Shadow UI → Shell Mode → Install as Windows Shell**. This runs `install-shell.ps1` which:
   - Refuses if elevated.
   - Writes `Shell` under `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Winlogon` to the app executable.
   - Backs up any previous value under `ShellBackup`.
5. Sign out and back in. Shadow UI is now your shell.

### Using the watchdog (recommended)
For a production install you probably want the watchdog to be the registered shell rather than the main exe, so that crashes don't leave you stranded. Invoke the script with the watchdog path instead:

```
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/install-shell.ps1 `
    -ShellExe "C:\Program Files\Shadow UI\resources\shell\watchdog.js"
```

(At the moment `watchdog.js` is a Node script shipped as an `extraResource`. If you want a native EXE, wrap it with [`pkg`](https://github.com/vercel/pkg) or [`nexe`](https://github.com/nexe/nexe) and point the installer at the wrapped binary.)

## Uninstalling shell mode
**Start Menu → Shadow UI → Shell Mode → Uninstall as Windows Shell**, or directly:

```
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall-shell.ps1
```

The script restores the previous `Shell` value from `ShellBackup`, or deletes it entirely so Windows falls back to `explorer.exe`.

## Recovery
If you ever log in and find yourself without a functioning shell:

1. Press **Ctrl+Alt+Del** and start **Task Manager**.
2. **File → Run new task** → run `powershell.exe`.
3. In PowerShell: `& "C:\Program Files\Shadow UI\resources\scripts\uninstall-shell.ps1"`
4. Sign out and back in.

If Task Manager is unavailable, `explorer.exe` typed into **Ctrl+Alt+Del → Run** also works.

## Security review
- All process spawns in shell mode use `spawn(shell: false)` with argv-array form. `processLauncher.js` validates paths for shell metacharacters, control characters, existence, and regular-file-ness before spawning.
- `sessionControl.js` accepts only four fixed actions and builds a hard-coded argv. Integer interpolation in `windowManager.js` is guarded by `Number.isInteger(n)` with a 32-bit range check before forming the PowerShell script.
- PowerShell invocations use `execFile` (no shell), `-NoProfile`, `-NonInteractive`, and an explicit argv. The only dynamic value in any script body is a validated PID.
- Start Menu enumeration refuses to follow symlinks and to cross its configured root; it caps depth and entry count.
- Registry scripts are strictly HKCU; they refuse to run elevated.
- The panic hotkey is always registered while in shell mode and always spawns `explorer.exe`, so users can recover without a keyboard/mouse-based fight against the kiosk window.
- All shell-mode IPC channels are rate-limited via the existing `limiter` pattern.
- Shell-mode IPC handlers are only registered when `SHELL_MODE` is true. The classic renderer still cannot call any of the new channels.

## Non-goals / known limitations
- No native N-API addon for tray icons or shell hooks. Notifications, tray, and `SHAppBarMessage` integration are out of scope. Window enumeration uses PowerShell, which is less accurate (and slower) than `EnumWindows` but portable and dependency-free.
- Logoff / shutdown / restart rely on `shutdown.exe`, which requires the current user to have the corresponding privilege. On locked-down corporate accounts some actions may fail gracefully with an error.
- Shadow UI does not replace the Windows logon screen or the Secure Attention Sequence.
- Focusing another process's window via `AppActivate` is best-effort; in some cases Windows will flash the taskbar instead of actually bringing the window forward.

## Troubleshooting
- "Shell API unavailable" in the UI: you launched the shell HTML without `--shell`. Start with `npm run shell:start` or pass `--shell` to the exe.
- Panic hotkey says it's not registered: another app (e.g. a games launcher) owns the accelerator. Change `shell.panicHotkey` in the config to a unique combination.
- Windows list is empty: PowerShell is blocked (ExecutionPolicy AllSigned, AppLocker, etc.). The feature degrades gracefully; launching applications still works.
- Installer shortcut for "Install as Windows Shell" says it's not allowed: don't run PowerShell as administrator. The script is HKCU-only by design.
