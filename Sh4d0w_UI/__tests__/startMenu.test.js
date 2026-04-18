// __tests__/startMenu.test.js
// Unit tests for shell/startMenu.js.

const os = require('os');
const fs = require('fs');
const path = require('path');

const { createStartMenu, enumerateLnk } = require('../shell/startMenu');

function mkTmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-test-'));
  return root;
}

function touch(p, content = '') {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

describe('enumerateLnk', () => {
  let root;

  beforeEach(() => {
    root = mkTmpRoot();
  });
  afterEach(() => {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('finds .lnk files at various depths', () => {
    touch(path.join(root, 'one.lnk'));
    touch(path.join(root, 'sub', 'two.lnk'));
    touch(path.join(root, 'sub', 'deeper', 'three.lnk'));
    // non-.lnk files should be ignored
    touch(path.join(root, 'note.txt'));
    const items = enumerateLnk(root);
    const names = items.map((i) => i.name).sort();
    expect(names).toEqual(['one', 'three', 'two']);
  });

  test('respects maxEntries cap', () => {
    for (let i = 0; i < 20; i++) {
      touch(path.join(root, `f${i}.lnk`));
    }
    const items = enumerateLnk(root, { maxEntries: 5 });
    expect(items.length).toBe(5);
  });

  test('returns empty for nonexistent root', () => {
    const items = enumerateLnk(path.join(root, 'nope'));
    expect(items).toEqual([]);
  });

  test('case-insensitive .LNK extension match', () => {
    touch(path.join(root, 'UPPER.LNK'));
    const items = enumerateLnk(root);
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('UPPER');
  });
});

describe('createStartMenu', () => {
  let root;

  beforeEach(() => {
    root = mkTmpRoot();
    touch(path.join(root, 'a.lnk'));
    touch(path.join(root, 'b.lnk'));
  });
  afterEach(() => {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('lists sorted results', () => {
    const sm = createStartMenu({ roots: [root], ttlMs: 10000 });
    const items = sm.list();
    expect(items.map((i) => i.name)).toEqual(['a', 'b']);
  });

  test('caches within TTL', () => {
    const sm = createStartMenu({ roots: [root], ttlMs: 60000 });
    const first = sm.list();
    touch(path.join(root, 'c.lnk'));
    const second = sm.list();
    // Cached -> still 2 entries
    expect(second.length).toBe(first.length);
  });

  test('invalidate forces re-enumeration', () => {
    const sm = createStartMenu({ roots: [root], ttlMs: 60000 });
    sm.list();
    touch(path.join(root, 'c.lnk'));
    sm.invalidate();
    const after = sm.list();
    expect(after.length).toBe(3);
  });

  test('deduplicates across multiple roots', () => {
    const sm = createStartMenu({ roots: [root, root], ttlMs: 10000 });
    const items = sm.list();
    // The same root listed twice should not produce duplicates.
    const unique = new Set(items.map((i) => i.path.toLowerCase()));
    expect(unique.size).toBe(items.length);
  });
});
