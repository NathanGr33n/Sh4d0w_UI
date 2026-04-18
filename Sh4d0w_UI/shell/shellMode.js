// shell/shellMode.js
// Shell-mode detection and kiosk window configuration.
//
// This module is intentionally side-effect free: it only exposes helper
// functions that the main process composes into its existing lifecycle.

'use strict';

const path = require('path');
const { spawn } = require('child_process');

/**
 * Detect whether the app should start in shell mode.
 * Priority: explicit config override > CLI flag > env var > false.
 *
 * @param {string[]} argv - Typically `process.argv`.
 * @param {NodeJS.ProcessEnv} env - Typically `process.env`.
 * @param {{ enabled?: boolean } | null} config - Optional persisted config.
 * @returns {boolean}
 */
function isShellMode(argv = process.argv, env = process.env, config = null) {
  if (config && typeof config.enabled === 'boolean' && config.enabled === true) {
    return true;
  }
  if (Array.isArray(argv) && argv.some((a) => a === '--shell' || a === '--kiosk-shell')) {
    return true;
  }
  if (env && (env.SHADOW_UI_SHELL === '1' || env.SHADOW_UI_SHELL === 'true')) {
    return true;
  }
  return false;
}

/**
 * Build BrowserWindow options appropriate for shell mode.
 * Caller is responsible for merging the existing `webPreferences`.
 *
 * @param {{ backgroundColor?: string }} base
 * @returns {import('electron').BrowserWindowConstructorOptions}
 */
function getShellWindowOptions(base = {}) {
  return {
    fullscreen: true,
    frame: false,
    kiosk: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: true,
    closable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    backgroundColor: base.backgroundColor || '#0b0f14',
    show: false,
  };
}

/**
 * Spawn explorer.exe as a detached child process. Used as a panic recovery
 * so the user is never stranded without a shell.
 *
 * Intentionally uses argv array form with `shell: false` to avoid any form
 * of command-line injection, even though there is no user input here.
 *
 * @param {{ logger?: { info?: Function, error?: Function, warn?: Function } }} [opts]
 * @returns {boolean} true if spawn succeeded
 */
function launchExplorer(opts = {}) {
  const logger = opts.logger;
  try {
    if (process.platform !== 'win32') {
      logger?.warn?.('launchExplorer ignored on non-Windows platform');
      return false;
    }
    const child = spawn('explorer.exe', [], {
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: false,
    });
    child.unref();
    logger?.info?.('Spawned explorer.exe (panic / fallback)');
    return true;
  } catch (err) {
    logger?.error?.('Failed to launch explorer.exe:', err);
    return false;
  }
}

/**
 * Register a global panic hotkey that spawns explorer.exe.
 * This exists so that even if Shadow UI is frozen the user can still
 * reach the real Windows shell.
 *
 * @param {{ globalShortcut: import('electron').GlobalShortcut, accelerator: string, logger?: any }} opts
 * @returns {{ accelerator: string, registered: boolean }}
 */
function registerPanicHotkey(opts) {
  const { globalShortcut, accelerator, logger } = opts;
  if (!globalShortcut || typeof globalShortcut.register !== 'function') {
    return { accelerator, registered: false };
  }
  const accel = typeof accelerator === 'string' && accelerator.length > 0
    ? accelerator
    : 'Control+Alt+Shift+E';
  try {
    const ok = globalShortcut.register(accel, () => {
      logger?.warn?.(`Panic hotkey ${accel} pressed; spawning explorer.exe`);
      launchExplorer({ logger });
    });
    if (!ok) {
      logger?.warn?.(`Failed to register panic hotkey ${accel} (already taken?)`);
    } else {
      logger?.info?.(`Panic hotkey registered: ${accel}`);
    }
    return { accelerator: accel, registered: Boolean(ok) };
  } catch (err) {
    logger?.error?.('Error registering panic hotkey:', err);
    return { accelerator: accel, registered: false };
  }
}

/**
 * Resolve the renderer entry point to load when the given mode is active.
 *
 * @param {boolean} shellMode
 * @param {string} baseDir - Typically __dirname of the main process file.
 * @returns {string} absolute path to an HTML file
 */
function resolveRendererEntry(shellMode, baseDir) {
  if (shellMode) {
    return path.join(baseDir, 'renderer', 'shell', 'index.html');
  }
  return path.join(baseDir, 'renderer', 'index.html');
}

module.exports = {
  isShellMode,
  getShellWindowOptions,
  launchExplorer,
  registerPanicHotkey,
  resolveRendererEntry,
};
