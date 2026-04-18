// __tests__/shellMode.test.js
// Unit tests for shell/shellMode.js.

const { isShellMode, getShellWindowOptions, resolveRendererEntry } =
  require('../shell/shellMode');

describe('isShellMode', () => {
  test('returns false by default', () => {
    expect(isShellMode([], {}, null)).toBe(false);
  });

  test('returns true when --shell is in argv', () => {
    expect(isShellMode(['node', 'main.js', '--shell'], {}, null)).toBe(true);
  });

  test('returns true when --kiosk-shell is in argv', () => {
    expect(isShellMode(['node', 'main.js', '--kiosk-shell'], {}, null)).toBe(true);
  });

  test('returns true when SHADOW_UI_SHELL=1', () => {
    expect(isShellMode([], { SHADOW_UI_SHELL: '1' }, null)).toBe(true);
  });

  test('returns true when SHADOW_UI_SHELL=true', () => {
    expect(isShellMode([], { SHADOW_UI_SHELL: 'true' }, null)).toBe(true);
  });

  test('respects config.enabled=true', () => {
    expect(isShellMode([], {}, { enabled: true })).toBe(true);
  });

  test('config.enabled=false alone does not enable', () => {
    expect(isShellMode([], {}, { enabled: false })).toBe(false);
  });

  test('ignores unrelated env and argv', () => {
    expect(isShellMode(['node', 'main.js', '--other'], { SOMETHING: '1' }, null)).toBe(false);
  });
});

describe('getShellWindowOptions', () => {
  test('returns kiosk-style BrowserWindow options', () => {
    const opts = getShellWindowOptions({ backgroundColor: '#000' });
    expect(opts.fullscreen).toBe(true);
    expect(opts.kiosk).toBe(true);
    expect(opts.alwaysOnTop).toBe(true);
    expect(opts.frame).toBe(false);
    expect(opts.backgroundColor).toBe('#000');
    // closable must be false so accidental Alt+F4 doesn't leave the user
    // without a shell.
    expect(opts.closable).toBe(false);
  });

  test('uses a sensible default background when none supplied', () => {
    const opts = getShellWindowOptions({});
    expect(typeof opts.backgroundColor).toBe('string');
    expect(opts.backgroundColor.length).toBeGreaterThan(0);
  });
});

describe('resolveRendererEntry', () => {
  test('returns shell index.html when shellMode is true', () => {
    const p = resolveRendererEntry(true, '/app');
    expect(p.replace(/\\/g, '/')).toContain('renderer/shell/index.html');
  });
  test('returns classic index.html when shellMode is false', () => {
    const p = resolveRendererEntry(false, '/app');
    const norm = p.replace(/\\/g, '/');
    expect(norm).toContain('renderer/index.html');
    expect(norm).not.toContain('renderer/shell/');
  });
});
