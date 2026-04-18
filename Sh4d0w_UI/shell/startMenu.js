// shell/startMenu.js
// Enumerate Start Menu shortcuts (.lnk) from the standard per-user
// and all-users Programs directories. No arbitrary path traversal is
// allowed -- only these two well-known roots are scanned.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function getDefaultRoots() {
  if (process.platform !== 'win32') {
    return [];
  }
  const appData = process.env.APPDATA ||
    path.join(os.homedir(), 'AppData', 'Roaming');
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  return [
    path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];
}

/**
 * Recursively enumerate `.lnk` shortcuts under a root directory, up to a
 * configurable depth. We never follow symlinks and never cross the root.
 *
 * @param {string} root
 * @param {{ maxDepth?: number, maxEntries?: number }} [opts]
 * @returns {{ name: string, path: string }[]}
 */
function enumerateLnk(root, opts = {}) {
  const maxDepth = Number.isFinite(opts.maxDepth) ? opts.maxDepth : 8;
  const maxEntries = Number.isFinite(opts.maxEntries) ? opts.maxEntries : 5000;
  const results = [];

  let resolvedRoot;
  try {
    resolvedRoot = fs.realpathSync(root);
  } catch {
    return results;
  }

  function walk(dir, depth) {
    if (depth > maxDepth || results.length >= maxEntries) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (results.length >= maxEntries) return;
      const full = path.join(dir, ent.name);
      // Refuse to follow symlinks outside the root.
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        // Do not cross root boundary.
        let real;
        try {
          real = fs.realpathSync(full);
        } catch {
          continue;
        }
        if (!real.startsWith(resolvedRoot)) continue;
        walk(full, depth + 1);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.lnk')) {
        results.push({
          name: ent.name.slice(0, -4),
          path: full,
        });
      }
    }
  }

  walk(resolvedRoot, 0);
  return results;
}

/**
 * Cached Start Menu enumerator.
 *
 * @param {{ ttlMs?: number, roots?: string[], logger?: any }} [opts]
 * @returns {{ list: () => {name: string, path: string}[], invalidate: () => void }}
 */
function createStartMenu(opts = {}) {
  const ttlMs = Number.isFinite(opts.ttlMs) ? opts.ttlMs : 30000;
  const roots = Array.isArray(opts.roots) && opts.roots.length > 0
    ? opts.roots.slice()
    : getDefaultRoots();
  const logger = opts.logger;

  let cache = null;
  let cacheAt = 0;

  function list() {
    const now = Date.now();
    if (cache && now - cacheAt < ttlMs) {
      return cache;
    }
    const merged = [];
    const seen = new Set();
    for (const root of roots) {
      if (typeof root !== 'string' || root.length === 0) continue;
      const items = enumerateLnk(root);
      for (const it of items) {
        const key = it.path.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(it);
      }
    }
    merged.sort((a, b) => a.name.localeCompare(b.name));
    cache = merged;
    cacheAt = now;
    logger?.info?.('Start Menu enumerated', { count: merged.length });
    return merged;
  }

  function invalidate() {
    cache = null;
    cacheAt = 0;
  }

  return { list, invalidate };
}

module.exports = {
  createStartMenu,
  enumerateLnk,
  getDefaultRoots,
};
