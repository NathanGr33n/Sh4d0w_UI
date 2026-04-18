// __tests__/processLauncher.test.js
// Unit tests for shell/processLauncher.js.

const os = require('os');
const path = require('path');
const fs = require('fs');

// We mock child_process.spawn so no real processes are started.
const spawnMock = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args) => spawnMock(...args),
}));

const {
  launchApp,
  validatePath,
  validateArg,
} = require('../shell/processLauncher');

function makeFakeChild() {
  return {
    pid: 4242,
    unref: jest.fn(),
    on: jest.fn(),
    kill: jest.fn(),
  };
}

describe('validatePath', () => {
  test('rejects non-strings', () => {
    expect(validatePath(123).ok).toBe(false);
    expect(validatePath(null).ok).toBe(false);
    expect(validatePath(undefined).ok).toBe(false);
  });

  test('rejects empty strings', () => {
    expect(validatePath('').ok).toBe(false);
  });

  test('rejects paths with shell metacharacters', () => {
    const cases = ['C:\\foo; rm -rf /', 'foo|bar', 'foo&bar', 'foo`bar', 'foo$(bar)'];
    for (const c of cases) {
      expect(validatePath(c).ok).toBe(false);
    }
  });

  test('rejects paths with control characters', () => {
    expect(validatePath('foo\nbar').ok).toBe(false);
    expect(validatePath('foo\x00bar').ok).toBe(false);
    expect(validatePath('foo<bar').ok).toBe(false);
  });

  test('rejects nonexistent paths', () => {
    const missing = path.join(os.tmpdir(), 'definitely-not-here-' + Date.now() + '.exe');
    expect(validatePath(missing).ok).toBe(false);
  });

  test('accepts an existing regular file', () => {
    const tmp = path.join(os.tmpdir(), 'shadow-ui-test-' + Date.now() + '.txt');
    fs.writeFileSync(tmp, 'hello');
    try {
      const res = validatePath(tmp);
      expect(res.ok).toBe(true);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  test('rejects a directory', () => {
    const res = validatePath(os.tmpdir());
    expect(res.ok).toBe(false);
  });
});

describe('validateArg', () => {
  test('rejects non-strings', () => {
    expect(validateArg(42).ok).toBe(false);
  });
  test('rejects newline / NUL', () => {
    expect(validateArg('a\nb').ok).toBe(false);
    expect(validateArg('a\x00b').ok).toBe(false);
  });
  test('accepts normal values', () => {
    expect(validateArg('--flag=value').ok).toBe(true);
    expect(validateArg('C:\\Program Files\\App').ok).toBe(true);
  });
});

describe('launchApp', () => {
  let tmpFile;

  beforeAll(() => {
    tmpFile = path.join(os.tmpdir(), 'shadow-ui-launch-' + Date.now() + '.txt');
    fs.writeFileSync(tmpFile, '');
  });
  afterAll(() => {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => makeFakeChild());
  });

  test('rejects invalid args array type', () => {
    const res = launchApp({ path: tmpFile, args: 'not-an-array' });
    expect(res.ok).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('rejects too many args', () => {
    const args = new Array(100).fill('a');
    const res = launchApp({ path: tmpFile, args });
    expect(res.ok).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('rejects args containing control chars', () => {
    const res = launchApp({ path: tmpFile, args: ['ok', 'bad\n'] });
    expect(res.ok).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('rejects metacharacter-laden paths before spawning', () => {
    const res = launchApp({ path: `${tmpFile};evil.exe` });
    expect(res.ok).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('always spawns with shell:false and argv-array form', () => {
    const res = launchApp({ path: tmpFile, args: ['--flag'] });
    expect(res.ok).toBe(true);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [spawnedPath, spawnedArgs, spawnOpts] = spawnMock.mock.calls[0];
    expect(spawnedPath).toBe(tmpFile);
    expect(Array.isArray(spawnedArgs)).toBe(true);
    expect(spawnedArgs).toEqual(['--flag']);
    expect(spawnOpts.shell).toBe(false);
    expect(spawnOpts.detached).toBe(true);
  });

  test('rejects a nonexistent cwd', () => {
    const res = launchApp({ path: tmpFile, cwd: '/this/does/not/exist-xyz-shadow' });
    expect(res.ok).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('accepts a valid cwd', () => {
    const res = launchApp({ path: tmpFile, cwd: os.tmpdir() });
    expect(res.ok).toBe(true);
    const [, , opts] = spawnMock.mock.calls[0];
    expect(opts.cwd).toBe(os.tmpdir());
  });
});
