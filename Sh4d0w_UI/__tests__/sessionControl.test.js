// __tests__/sessionControl.test.js
// Unit tests for shell/sessionControl.js.

const { buildArgv, VALID_ACTIONS } = require('../shell/sessionControl');

describe('sessionControl.buildArgv', () => {
  test('rejects unknown actions', () => {
    expect(() => buildArgv('format-disk')).toThrow();
    expect(() => buildArgv(null)).toThrow();
    expect(() => buildArgv(undefined)).toThrow();
    expect(() => buildArgv(42)).toThrow();
  });

  test('exports a fixed set of valid actions', () => {
    expect([...VALID_ACTIONS].sort()).toEqual(['lock', 'logoff', 'restart', 'shutdown']);
  });

  test('logoff uses shutdown.exe /l', () => {
    const argv = buildArgv('logoff');
    expect(argv.exe.toLowerCase()).toContain('shutdown.exe');
    expect(argv.args).toEqual(['/l']);
  });

  test('restart uses /r /t 0 by default', () => {
    const argv = buildArgv('restart');
    expect(argv.exe.toLowerCase()).toContain('shutdown.exe');
    expect(argv.args).toEqual(['/r', '/t', '0']);
  });

  test('shutdown uses /s /t 0 by default', () => {
    const argv = buildArgv('shutdown');
    expect(argv.exe.toLowerCase()).toContain('shutdown.exe');
    expect(argv.args).toEqual(['/s', '/t', '0']);
  });

  test('timeoutSeconds coerced to non-negative integer', () => {
    expect(buildArgv('restart', { timeoutSeconds: 5 }).args).toEqual(['/r', '/t', '5']);
    // Non-integer -> default 0
    expect(buildArgv('restart', { timeoutSeconds: 'abc' }).args).toEqual(['/r', '/t', '0']);
    // Negative -> default 0
    expect(buildArgv('restart', { timeoutSeconds: -10 }).args).toEqual(['/r', '/t', '0']);
  });

  test('timeoutSeconds capped at 315360000 (10 years)', () => {
    expect(buildArgv('restart', { timeoutSeconds: 9e18 }).args).toEqual(['/r', '/t', '315360000']);
    // Non-finite (NaN / Infinity) -> default 0 (Number.isInteger returns false)
    expect(buildArgv('restart', { timeoutSeconds: Infinity }).args).toEqual(['/r', '/t', '0']);
    expect(buildArgv('restart', { timeoutSeconds: NaN }).args).toEqual(['/r', '/t', '0']);
  });

  test('lock uses rundll32.exe', () => {
    const argv = buildArgv('lock');
    expect(argv.exe.toLowerCase()).toContain('rundll32.exe');
    expect(argv.args).toEqual(['user32.dll,LockWorkStation']);
  });

  test('argv is always an array of strings', () => {
    for (const action of VALID_ACTIONS) {
      const argv = buildArgv(action);
      expect(Array.isArray(argv.args)).toBe(true);
      argv.args.forEach((a) => expect(typeof a).toBe('string'));
      expect(typeof argv.exe).toBe('string');
    }
  });
});
