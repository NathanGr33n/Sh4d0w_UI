// shell/sessionControl.js
// Session-level power controls (logoff / restart / shutdown / lock).
//
// All commands are executed with `spawn`, `shell: false`, and argv-array
// form. No user input is ever passed to these functions; the argv is
// hard-coded based on the requested action. If we ever allow custom
// timeouts we still coerce them to integers before forming argv.

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const VALID_ACTIONS = new Set(['logoff', 'restart', 'shutdown', 'lock']);

function getSystem32Dir() {
  // Prefer %windir%\System32 so we don't depend on PATH.
  const winDir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
  return path.join(winDir, 'System32');
}

/**
 * Build the argv for a given action.
 * Returns `{ exe, args }` or throws on invalid input.
 *
 * @param {string} action
 * @param {{ timeoutSeconds?: number }} [opts]
 */
function buildArgv(action, opts = {}) {
  if (typeof action !== 'string' || !VALID_ACTIONS.has(action)) {
    throw new Error(`invalid session action: ${action}`);
  }
  const sys32 = getSystem32Dir();
  const timeout = Number.isInteger(opts.timeoutSeconds) && opts.timeoutSeconds >= 0
    ? Math.min(315360000, opts.timeoutSeconds)
    : 0;

  switch (action) {
    case 'logoff':
      return {
        exe: path.join(sys32, 'shutdown.exe'),
        args: ['/l'],
      };
    case 'restart':
      return {
        exe: path.join(sys32, 'shutdown.exe'),
        args: ['/r', '/t', String(timeout)],
      };
    case 'shutdown':
      return {
        exe: path.join(sys32, 'shutdown.exe'),
        args: ['/s', '/t', String(timeout)],
      };
    case 'lock':
      return {
        exe: path.join(sys32, 'rundll32.exe'),
        args: ['user32.dll,LockWorkStation'],
      };
    default:
      // Unreachable due to VALID_ACTIONS guard above.
      throw new Error(`invalid session action: ${action}`);
  }
}

/**
 * Execute one of the supported session actions.
 *
 * @param {'logoff'|'restart'|'shutdown'|'lock'} action
 * @param {{ timeoutSeconds?: number, logger?: any }} [opts]
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
function performAction(action, opts = {}) {
  const logger = opts.logger;
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ ok: false, error: 'session controls only available on Windows' });
    }
    let argv;
    try {
      argv = buildArgv(action, opts);
    } catch (err) {
      return resolve({ ok: false, error: err.message });
    }
    try {
      const child = spawn(argv.exe, argv.args, {
        shell: false,
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.on('error', (err) => {
        logger?.error?.('session action spawn error', { action, error: err.message });
        resolve({ ok: false, error: err.message });
      });
      // For fire-and-forget actions, we don't wait for exit. shutdown.exe
      // with /t 0 returns immediately anyway.
      child.unref();
      logger?.warn?.('session action invoked', { action, exe: argv.exe, args: argv.args });
      // Give Windows a brief tick to initiate the action before resolving.
      setTimeout(() => resolve({ ok: true }), 50);
    } catch (err) {
      logger?.error?.('session action error', { action, error: err.message });
      resolve({ ok: false, error: err.message });
    }
  });
}

module.exports = {
  performAction,
  buildArgv,
  VALID_ACTIONS,
};
