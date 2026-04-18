// shell/windowManager.js
// Best-effort window enumeration and focus helper for shell mode.
//
// This deliberately avoids native modules: it shells out to PowerShell
// (powershell.exe or pwsh.exe) using argv-array form. Results are parsed
// as JSON. If PowerShell is not available, functions degrade to empty /
// no-op. This is a best-effort fallback -- a proper implementation would
// use a native N-API addon that calls EnumWindows.

'use strict';

const { execFile } = require('child_process');

function getPowerShellPath() {
  if (process.platform !== 'win32') return null;
  // Prefer the traditional Windows PowerShell which is guaranteed to ship
  // with the OS. pwsh.exe (PowerShell 7+) is not always installed.
  return 'powershell.exe';
}

function runPowerShellScript(script, timeoutMs, logger) {
  return new Promise((resolve) => {
    const psPath = getPowerShellPath();
    if (!psPath) return resolve({ ok: false, error: 'powershell unavailable' });
    // Flags chosen so we get a clean, predictable execution environment
    // and deliberately set ExecutionPolicy Bypass only for this single
    // inline command. We never pass user-controlled strings to PowerShell.
    const args = [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-OutputFormat', 'Text',
      '-Command', script,
    ];
    execFile(psPath, args, {
      timeout: Math.max(1000, Math.min(30000, timeoutMs || 5000)),
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      shell: false,
    }, (err, stdout, stderr) => {
      if (err) {
        logger?.warn?.('PowerShell invocation failed', { code: err.code, stderr: String(stderr).slice(0, 400) });
        return resolve({ ok: false, error: err.message });
      }
      resolve({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

/**
 * Enumerate top-level windows by querying processes with a non-empty
 * MainWindowTitle. Returns a JSON array of { pid, title, processName }.
 *
 * @param {{ logger?: any, timeoutMs?: number, max?: number }} [opts]
 */
async function listWindows(opts = {}) {
  const logger = opts.logger;
  const max = Number.isFinite(opts.max) ? opts.max : 200;
  // Note: no user input is interpolated; script is a hard-coded literal.
  const script =
    'Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | ' +
    'Select-Object Id, ProcessName, MainWindowTitle | ' +
    'ConvertTo-Json -Compress -Depth 2';
  const res = await runPowerShellScript(script, opts.timeoutMs || 5000, logger);
  if (!res.ok) return [];
  let parsed;
  try {
    parsed = JSON.parse(res.stdout || '[]');
  } catch (err) {
    logger?.warn?.('Failed to parse window list JSON', { error: err.message });
    return [];
  }
  if (parsed == null) return [];
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr
    .slice(0, max)
    .map((w) => ({
      pid: Number(w.Id) || 0,
      processName: String(w.ProcessName || '').slice(0, 128),
      title: String(w.MainWindowTitle || '').slice(0, 256),
    }))
    .filter((w) => w.pid > 0 && w.title.length > 0);
}

/**
 * Best-effort focus for a window belonging to `pid`. Uses the same
 * PowerShell + AppActivate trick that many Windows admin scripts use. The
 * `pid` is coerced to an integer before being placed into the script, and
 * the script itself contains no other interpolations.
 *
 * @param {number} pid
 * @param {{ logger?: any, timeoutMs?: number }} [opts]
 */
async function focusWindow(pid, opts = {}) {
  const logger = opts.logger;
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0 || n > 0xffffffff) {
    return { ok: false, error: 'invalid pid' };
  }
  // Safe: only integer interpolation, validated above.
  const script =
    'Add-Type -AssemblyName Microsoft.VisualBasic; ' +
    `$proc = Get-Process -Id ${n} -ErrorAction SilentlyContinue; ` +
    'if ($proc) { ' +
    '  try { [Microsoft.VisualBasic.Interaction]::AppActivate($proc.Id) | Out-Null; ' +
    '    Write-Output "OK" } catch { Write-Output "ERR" }' +
    '} else { Write-Output "NOT_FOUND" }';
  const res = await runPowerShellScript(script, opts.timeoutMs || 3000, logger);
  if (!res.ok) return { ok: false, error: res.error };
  const out = (res.stdout || '').trim();
  if (out.includes('OK')) return { ok: true };
  if (out.includes('NOT_FOUND')) return { ok: false, error: 'process not found' };
  return { ok: false, error: 'focus failed' };
}

module.exports = {
  listWindows,
  focusWindow,
  _runPowerShellScript: runPowerShellScript,
};
