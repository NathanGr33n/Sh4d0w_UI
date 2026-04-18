#!/usr/bin/env node
// shell/watchdog.js
// Watchdog / supervisor process for Shadow UI in shell-replacement mode.
//
// Responsibilities:
//   - Spawn the main Shadow UI executable with `--shell`.
//   - Restart it if it exits, up to `retries` times inside `windowMs`.
//   - If the retry budget is exhausted, spawn explorer.exe so the user is
//     never left without a shell, then exit cleanly.
//
// This module is packaged as an extraResource alongside the app and is the
// executable that is installed into HKCU\...\Winlogon\Shell.

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function parseOptions() {
  const args = process.argv.slice(2);
  const opts = {
    // Path to the Shadow UI executable. Defaults are resolved lazily.
    exe: null,
    retries: 5,
    windowMs: 60000,
    fallback: true,
    logDir: path.join(os.homedir(), '.shadow-ui', 'logs'),
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--exe') opts.exe = args[++i];
    else if (a === '--retries') opts.retries = parseInt(args[++i], 10);
    else if (a === '--window-ms') opts.windowMs = parseInt(args[++i], 10);
    else if (a === '--no-fallback') opts.fallback = false;
    else if (a === '--log-dir') opts.logDir = args[++i];
  }
  if (!Number.isInteger(opts.retries) || opts.retries < 0) opts.retries = 5;
  if (!Number.isInteger(opts.windowMs) || opts.windowMs < 1000) opts.windowMs = 60000;
  return opts;
}

function resolveDefaultExe() {
  // When packaged, electron-builder places the main exe alongside the
  // resources directory. We accept ELECTRON_EXEC_PATH as an override for
  // development.
  if (process.env.SHADOW_UI_EXE && fs.existsSync(process.env.SHADOW_UI_EXE)) {
    return process.env.SHADOW_UI_EXE;
  }
  // Best-effort: look one level up from resources/
  const resourcesDir = path.resolve(__dirname, '..');
  const parent = path.resolve(resourcesDir, '..');
  const candidates = [
    path.join(parent, 'Shadow UI.exe'),
    path.join(parent, 'ShadowUI.exe'),
  ];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch { /* ignore */ }
  }
  return null;
}

function ensureLogDir(logDir) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch { /* best-effort */ }
}

function openLog(logDir) {
  ensureLogDir(logDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(logDir, `watchdog-${stamp}.log`);
  try {
    return fs.createWriteStream(file, { flags: 'a' });
  } catch {
    return null;
  }
}

function log(stream, level, msg, meta) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    meta: meta || null,
  }) + '\n';
  try { stream && stream.write(line); } catch { /* ignore */ }
  // Also emit to stderr so it shows up in console if attached.
  try {
    (level === 'error' ? process.stderr : process.stdout).write(line);
  } catch { /* ignore */ }
}

function spawnApp(exe, logStream) {
  log(logStream, 'info', 'spawning app', { exe });
  return spawn(exe, ['--shell'], {
    stdio: 'ignore',
    detached: false,
    shell: false,
    windowsHide: false,
  });
}

function spawnExplorer(logStream) {
  log(logStream, 'warn', 'spawning explorer.exe as fallback');
  try {
    const child = spawn('explorer.exe', [], {
      detached: true,
      stdio: 'ignore',
      shell: false,
    });
    child.unref();
  } catch (err) {
    log(logStream, 'error', 'failed to spawn explorer.exe', { error: err.message });
  }
}

function main() {
  const opts = parseOptions();
  const exe = opts.exe || resolveDefaultExe();
  const logStream = openLog(opts.logDir);
  log(logStream, 'info', 'watchdog starting', { opts, exe });

  if (!exe) {
    log(logStream, 'error', 'no Shadow UI executable found; falling back to explorer.exe');
    if (opts.fallback) spawnExplorer(logStream);
    process.exit(1);
  }
  if (process.platform !== 'win32') {
    log(logStream, 'error', 'watchdog is Windows-only; exiting');
    process.exit(0);
  }

  const exitTimes = [];
  let stopped = false;
  let current = null;

  function gracefulStop(signal) {
    stopped = true;
    if (current && !current.killed) {
      try { current.kill(signal || 'SIGTERM'); } catch { /* ignore */ }
    }
    log(logStream, 'info', 'watchdog stopping', { signal });
    setTimeout(() => process.exit(0), 100);
  }

  process.on('SIGINT', () => gracefulStop('SIGINT'));
  process.on('SIGTERM', () => gracefulStop('SIGTERM'));

  function launchCycle() {
    if (stopped) return;
    current = spawnApp(exe, logStream);
    current.on('exit', (code, signal) => {
      log(logStream, 'warn', 'app exited', { code, signal });
      if (stopped) return;
      const now = Date.now();
      exitTimes.push(now);
      // Drop exits outside the sliding window.
      while (exitTimes.length > 0 && now - exitTimes[0] > opts.windowMs) {
        exitTimes.shift();
      }
      if (exitTimes.length > opts.retries) {
        log(logStream, 'error', 'retry budget exhausted', {
          exits: exitTimes.length,
          retries: opts.retries,
          windowMs: opts.windowMs,
        });
        if (opts.fallback) spawnExplorer(logStream);
        process.exit(2);
      }
      // Small backoff to avoid tight crash loops.
      setTimeout(launchCycle, 500);
    });
    current.on('error', (err) => {
      log(logStream, 'error', 'spawn error', { error: err.message });
    });
  }

  launchCycle();
}

if (require.main === module) {
  main();
}

module.exports = { parseOptions, resolveDefaultExe };
