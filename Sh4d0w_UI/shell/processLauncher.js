// shell/processLauncher.js
// Safe external process launcher for shell mode.
//
// Security guarantees:
//   - Always uses `spawn` with `shell: false` and argv-array form, so
//     there is no command-line concatenation and no shell interpretation.
//   - Rejects paths containing shell metacharacters or control characters.
//   - Verifies the target file exists and is a regular file before spawning.
//   - Never accepts a single concatenated command string.

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Characters that have no business appearing in a legitimate executable path.
// This matches both *nix and Windows shell metacharacters plus any control chars.
const DANGEROUS_PATH_CHARS = /[\x00-\x1f<>|"*?\r\n]/;
// Metacharacters we also disallow even though spawn is not a shell, to defend
// against downstream code paths that might accidentally concatenate strings.
const SHELL_METACHARS = /[&;`$(){}\[\]!]/;

/**
 * Validate an executable path.
 * Returns `{ ok: true }` on success or `{ ok: false, reason }` otherwise.
 *
 * @param {unknown} p
 * @returns {{ ok: boolean, reason?: string }}
 */
function validatePath(p) {
  if (typeof p !== 'string') {
    return { ok: false, reason: 'path must be a string' };
  }
  if (p.length === 0 || p.length > 32767) {
    return { ok: false, reason: 'path has invalid length' };
  }
  if (DANGEROUS_PATH_CHARS.test(p)) {
    return { ok: false, reason: 'path contains forbidden characters' };
  }
  if (SHELL_METACHARS.test(p)) {
    return { ok: false, reason: 'path contains shell metacharacters' };
  }
  // Basic stat check -- must exist and be a regular file.
  let stat;
  try {
    stat = fs.statSync(p);
  } catch (err) {
    return { ok: false, reason: `path does not exist: ${err.code || err.message}` };
  }
  if (!stat.isFile()) {
    return { ok: false, reason: 'path is not a regular file' };
  }
  return { ok: true };
}

/**
 * Validate a single argv element. Disallows embedded NUL / newline bytes which
 * could confuse downstream parsers if the callee re-serializes arguments.
 *
 * @param {unknown} a
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateArg(a) {
  if (typeof a !== 'string') {
    return { ok: false, reason: 'argument must be a string' };
  }
  if (a.length > 32767) {
    return { ok: false, reason: 'argument is too long' };
  }
  if (/[\x00\r\n]/.test(a)) {
    return { ok: false, reason: 'argument contains control characters' };
  }
  return { ok: true };
}

/**
 * Launch an application.
 *
 * @param {{ path: string, args?: string[], cwd?: string, detached?: boolean,
 *           logger?: { info?: Function, warn?: Function, error?: Function } }} opts
 * @returns {{ ok: boolean, pid?: number, error?: string }}
 */
function launchApp(opts = {}) {
  const { path: exePath, args = [], cwd = null, detached = true, logger } = opts;

  const pathCheck = validatePath(exePath);
  if (!pathCheck.ok) {
    logger?.warn?.('launchApp rejected path', { path: exePath, reason: pathCheck.reason });
    return { ok: false, error: pathCheck.reason };
  }

  if (!Array.isArray(args)) {
    return { ok: false, error: 'args must be an array' };
  }
  if (args.length > 64) {
    return { ok: false, error: 'too many arguments' };
  }
  for (const arg of args) {
    const ac = validateArg(arg);
    if (!ac.ok) {
      logger?.warn?.('launchApp rejected arg', { arg, reason: ac.reason });
      return { ok: false, error: ac.reason };
    }
  }

  let resolvedCwd;
  if (cwd === null || cwd === undefined) {
    resolvedCwd = path.dirname(exePath);
  } else {
    if (typeof cwd !== 'string' || DANGEROUS_PATH_CHARS.test(cwd) || SHELL_METACHARS.test(cwd)) {
      return { ok: false, error: 'cwd contains forbidden characters' };
    }
    try {
      const cs = fs.statSync(cwd);
      if (!cs.isDirectory()) {
        return { ok: false, error: 'cwd is not a directory' };
      }
    } catch (err) {
      return { ok: false, error: `cwd does not exist: ${err.code || err.message}` };
    }
    resolvedCwd = cwd;
  }

  try {
    const child = spawn(exePath, args, {
      cwd: resolvedCwd,
      detached: detached !== false,
      stdio: 'ignore',
      shell: false,
      windowsHide: false,
    });
    if (detached !== false) {
      child.unref();
    }
    logger?.info?.('launchApp spawned', {
      path: exePath,
      pid: child.pid,
      args: args.length,
    });
    return { ok: true, pid: child.pid };
  } catch (err) {
    logger?.error?.('launchApp spawn error', { path: exePath, error: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = {
  launchApp,
  validatePath,
  validateArg,
  DANGEROUS_PATH_CHARS,
  SHELL_METACHARS,
};
