// sessionManager.test.js
// Tests for Terminal Session Persistence Manager

const SessionManager = require('../sessionManager');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Mock electron-store
jest.mock('electron-store', () => {
  return class MockStore {
    constructor() {
      this.data = {
        lastSession: null,
        sessions: [],
      };
    }

    get(key, defaultValue) {
      return this.data[key] !== undefined ? this.data[key] : defaultValue;
    }

    set(key, value) {
      this.data[key] = value;
    }

    clear() {
      this.data = {
        lastSession: null,
        sessions: [],
      };
    }
  };
});

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('SessionManager', () => {
  let sessionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager(mockLogger);
    sessionManager.store.clear();
  });

  describe('saveSession', () => {
    it('should save a valid session', () => {
      const sessionData = {
        cwd: process.cwd(),
        shell: 'powershell.exe',
        cols: 120,
        rows: 32,
      };

      const saved = sessionManager.saveSession(sessionData);

      expect(saved).toBeDefined();
      expect(saved.cwd).toBe(process.cwd());
      expect(saved.shell).toBe('powershell.exe');
      expect(saved.cols).toBe(120);
      expect(saved.rows).toBe(32);
      expect(saved.timestamp).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Terminal session saved',
        expect.any(Object)
      );
    });

    it('should use defaults for missing fields', () => {
      const sessionData = {};

      const saved = sessionManager.saveSession(sessionData);

      expect(saved.cwd).toBeDefined();
      expect(saved.shell).toBeDefined();
      expect(saved.cols).toBe(80); // default
      expect(saved.rows).toBe(24); // default
    });

    it('should validate and clamp terminal dimensions', () => {
      const sessionData = {
        cwd: process.cwd(),
        shell: 'bash',
        cols: 1000, // exceeds max
        rows: -5, // invalid
      };

      const saved = sessionManager.saveSession(sessionData);

      expect(saved.cols).toBe(80); // clamped to default
      expect(saved.rows).toBe(24); // clamped to default
    });

    it('should sanitize shell names', () => {
      const sessionData = {
        cwd: process.cwd(),
        shell: '../malicious/shell',
        cols: 80,
        rows: 24,
      };

      const saved = sessionManager.saveSession(sessionData);

      // Should use default shell instead of malicious one
      expect(saved.shell).not.toContain('malicious');
    });

    it('should maintain session history (last 10)', () => {
      // Save 12 sessions
      for (let i = 0; i < 12; i++) {
        sessionManager.saveSession({
          cwd: process.cwd(),
          shell: 'bash',
          cols: 80,
          rows: 24,
        });
      }

      const sessions = sessionManager.getAllSessions();
      expect(sessions.length).toBe(10);
    });

    it('should throw error for invalid session data', () => {
      expect(() => {
        sessionManager.saveSession(null);
      }).toThrow('Invalid session data');

      expect(() => {
        sessionManager.saveSession('not an object');
      }).toThrow('Invalid session data');
    });
  });

  describe('loadLastSession', () => {
    it('should load the last saved session', () => {
      const sessionData = {
        cwd: process.cwd(),
        shell: 'powershell.exe',
        cols: 100,
        rows: 30,
      };

      sessionManager.saveSession(sessionData);
      const loaded = sessionManager.loadLastSession();

      expect(loaded).toBeDefined();
      expect(loaded.cwd).toBe(process.cwd());
      expect(loaded.shell).toBe('powershell.exe');
      expect(loaded.cols).toBe(100);
      expect(loaded.rows).toBe(30);
    });

    it('should return null when no session exists', () => {
      const loaded = sessionManager.loadLastSession();

      expect(loaded).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith('No previous session found');
    });

    it('should fall back to home directory if saved cwd does not exist', () => {
      const sessionData = {
        cwd: '/nonexistent/directory/path',
        shell: 'bash',
        cols: 80,
        rows: 24,
      };

      sessionManager.saveSession(sessionData);
      const loaded = sessionManager.loadLastSession();

      expect(loaded.cwd).toBe(os.homedir());
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Saved directory does not exist, using home',
        expect.any(Object)
      );
    });

    it('should fall back to home if saved cwd is not a directory', () => {
      // Create a test file (not a directory)
      const testFile = path.join(os.tmpdir(), 'test-file.txt');
      fs.writeFileSync(testFile, 'test');

      const sessionData = {
        cwd: testFile,
        shell: 'bash',
        cols: 80,
        rows: 24,
      };

      sessionManager.saveSession(sessionData);
      const loaded = sessionManager.loadLastSession();

      expect(loaded.cwd).toBe(os.homedir());

      // Cleanup
      fs.unlinkSync(testFile);
    });
  });

  describe('getAllSessions', () => {
    it('should return all saved sessions', () => {
      sessionManager.saveSession({ cwd: '/path1', shell: 'bash', cols: 80, rows: 24 });
      sessionManager.saveSession({ cwd: '/path2', shell: 'zsh', cols: 100, rows: 30 });

      const sessions = sessionManager.getAllSessions();

      expect(sessions.length).toBe(2);
      expect(sessions[0].shell).toBe('zsh'); // Most recent first
      expect(sessions[1].shell).toBe('bash');
    });

    it('should return empty array when no sessions exist', () => {
      const sessions = sessionManager.getAllSessions();

      expect(sessions).toEqual([]);
    });
  });

  describe('clearSessions', () => {
    it('should clear all sessions', () => {
      sessionManager.saveSession({ cwd: process.cwd(), shell: 'bash', cols: 80, rows: 24 });
      sessionManager.saveSession({ cwd: process.cwd(), shell: 'zsh', cols: 80, rows: 24 });

      sessionManager.clearSessions();

      const lastSession = sessionManager.loadLastSession();
      const allSessions = sessionManager.getAllSessions();

      expect(lastSession).toBeNull();
      expect(allSessions).toEqual([]);
      expect(mockLogger.info).toHaveBeenCalledWith('All sessions cleared');
    });
  });

  describe('clearOldSessions', () => {
    it('should remove sessions older than specified days', () => {
      const now = Date.now();
      const oldTimestamp = now - 31 * 24 * 60 * 60 * 1000; // 31 days ago
      const recentTimestamp = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago

      // Manually set sessions with specific timestamps
      sessionManager.store.set('sessions', [
        { cwd: '/path1', shell: 'bash', cols: 80, rows: 24, timestamp: recentTimestamp },
        { cwd: '/path2', shell: 'zsh', cols: 80, rows: 24, timestamp: oldTimestamp },
      ]);

      sessionManager.clearOldSessions(30);

      const sessions = sessionManager.getAllSessions();

      expect(sessions.length).toBe(1);
      expect(sessions[0].shell).toBe('bash');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleared sessions older than 30 days',
        expect.objectContaining({
          removed: 1,
          kept: 1,
        })
      );
    });

    it('should keep all sessions if none are old enough', () => {
      sessionManager.saveSession({ cwd: '/path1', shell: 'bash', cols: 80, rows: 24 });
      sessionManager.saveSession({ cwd: '/path2', shell: 'zsh', cols: 80, rows: 24 });

      sessionManager.clearOldSessions(30);

      const sessions = sessionManager.getAllSessions();

      expect(sessions.length).toBe(2);
    });
  });

  describe('Security validations', () => {
    it('should sanitize paths with traversal attempts', () => {
      const sessionData = {
        cwd: '../../../etc/passwd',
        shell: 'bash',
        cols: 80,
        rows: 24,
      };

      const saved = sessionManager.saveSession(sessionData);

      // Should fall back to process.cwd()
      expect(saved.cwd).not.toContain('..');
    });

    it('should only allow whitelisted shells', () => {
      const maliciousShells = [
        '/usr/bin/malicious',
        'rm -rf /',
        'evil.exe',
        '../../../bin/bash',
      ];

      maliciousShells.forEach((shell) => {
        const saved = sessionManager.saveSession({
          cwd: process.cwd(),
          shell,
          cols: 80,
          rows: 24,
        });

        // Should use default shell
        const allowedShells = [
          'powershell.exe',
          'pwsh.exe',
          'cmd.exe',
          'bash',
          'zsh',
          'fish',
          'sh',
        ];
        const isAllowed = allowedShells.some((allowed) =>
          saved.shell.toLowerCase().includes(allowed)
        );
        expect(isAllowed).toBe(true);
      });
    });

    it('should validate terminal dimensions within safe bounds', () => {
      const testCases = [
        { cols: 0, rows: 24, expectedCols: 80 },
        { cols: 80, rows: 0, expectedRows: 24 },
        { cols: 600, rows: 24, expectedCols: 80 }, // exceeds max
        { cols: 80, rows: 300, expectedRows: 24 }, // exceeds max
        { cols: -10, rows: 24, expectedCols: 80 },
        { cols: 80, rows: -10, expectedRows: 24 },
      ];

      testCases.forEach((testCase) => {
        const saved = sessionManager.saveSession({
          cwd: process.cwd(),
          shell: 'bash',
          cols: testCase.cols,
          rows: testCase.rows,
        });

        expect(saved.cols).toBe(testCase.expectedCols || testCase.cols);
        expect(saved.rows).toBe(testCase.expectedRows || testCase.rows);
      });
    });
  });
});
