// sessionManager.js
// Terminal Session Persistence Manager
// Handles saving and restoring terminal sessions across app restarts

const Store = require('electron-store');
const path = require('path');
const os = require('os');

class SessionManager {
  constructor(logger) {
    this.logger = logger;
    this.store = new Store({
      name: 'terminal-sessions',
      defaults: {
        lastSession: null,
        sessions: [],
      },
    });
  }

  /**
   * Save the current terminal session state
   * @param {Object} sessionData - Session data to save
   * @param {string} sessionData.cwd - Current working directory
   * @param {string} sessionData.shell - Shell type (e.g., 'powershell.exe', 'bash')
   * @param {number} sessionData.cols - Terminal columns
   * @param {number} sessionData.rows - Terminal rows
   * @param {number} sessionData.timestamp - Session timestamp
   */
  saveSession(sessionData) {
    try {
      // Validate session data
      if (!sessionData || typeof sessionData !== 'object') {
        throw new Error('Invalid session data');
      }

      // Sanitize and validate session data
      const session = {
        cwd: this._sanitizePath(sessionData.cwd || process.cwd()),
        shell: this._sanitizeShell(sessionData.shell || this._getDefaultShell()),
        cols: this._validateNumber(sessionData.cols, 80, 1, 500),
        rows: this._validateNumber(sessionData.rows, 24, 1, 200),
        timestamp: Date.now(),
      };

      // Save as the last session
      this.store.set('lastSession', session);

      // Also add to sessions history (keep last 10)
      const sessions = this.store.get('sessions', []);
      sessions.unshift(session);
      this.store.set('sessions', sessions.slice(0, 10));

      this.logger?.info('Terminal session saved', {
        cwd: session.cwd,
        shell: session.shell,
      });

      return session;
    } catch (error) {
      this.logger?.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Load the last terminal session
   * @returns {Object|null} - Last session data or null if none exists
   */
  loadLastSession() {
    try {
      const session = this.store.get('lastSession');

      if (!session) {
        this.logger?.info('No previous session found');
        return null;
      }

      // Validate that the saved directory still exists and is accessible
      const fs = require('fs');
      try {
        const stats = fs.statSync(session.cwd);
        if (!stats.isDirectory()) {
          this.logger?.warn('Saved directory is not a directory, using home', {
            cwd: session.cwd,
          });
          session.cwd = os.homedir();
        }
      } catch (err) {
        this.logger?.warn('Saved directory does not exist, using home', {
          cwd: session.cwd,
          error: err.message,
        });
        session.cwd = os.homedir();
      }

      this.logger?.info('Restored terminal session', {
        cwd: session.cwd,
        shell: session.shell,
        age: `${Math.round((Date.now() - session.timestamp) / 1000)}s`,
      });

      return session;
    } catch (error) {
      this.logger?.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Get all saved sessions
   * @returns {Array} - Array of session objects
   */
  getAllSessions() {
    try {
      return this.store.get('sessions', []);
    } catch (error) {
      this.logger?.error('Failed to get sessions:', error);
      return [];
    }
  }

  /**
   * Clear all saved sessions
   */
  clearSessions() {
    try {
      this.store.set('lastSession', null);
      this.store.set('sessions', []);
      this.logger?.info('All sessions cleared');
    } catch (error) {
      this.logger?.error('Failed to clear sessions:', error);
      throw error;
    }
  }

  /**
   * Clear sessions older than specified days
   * @param {number} days - Number of days to keep
   */
  clearOldSessions(days = 30) {
    try {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const sessions = this.store.get('sessions', []);
      const filtered = sessions.filter((s) => s.timestamp >= cutoff);

      this.store.set('sessions', filtered);
      this.logger?.info(`Cleared sessions older than ${days} days`, {
        removed: sessions.length - filtered.length,
        kept: filtered.length,
      });
    } catch (error) {
      this.logger?.error('Failed to clear old sessions:', error);
      throw error;
    }
  }

  // Private helper methods

  _getDefaultShell() {
    return process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';
  }

  _sanitizePath(pathStr) {
    // Ensure path is a string and normalize it
    if (typeof pathStr !== 'string') {
      return process.cwd();
    }

    try {
      // Resolve to absolute path and normalize
      const normalized = path.normalize(path.resolve(pathStr));

      // Basic path traversal protection
      if (normalized.includes('..')) {
        this.logger?.warn('Path contains traversal, using cwd', { path: pathStr });
        return process.cwd();
      }

      return normalized;
    } catch (error) {
      this.logger?.warn('Failed to sanitize path, using cwd', { path: pathStr, error });
      return process.cwd();
    }
  }

  _sanitizeShell(shell) {
    // Whitelist of allowed shells
    const allowedShells = [
      'powershell.exe',
      'pwsh.exe',
      'cmd.exe',
      'bash',
      'zsh',
      'fish',
      'sh',
      '/bin/bash',
      '/bin/zsh',
      '/bin/fish',
      '/bin/sh',
    ];

    if (typeof shell !== 'string') {
      return this._getDefaultShell();
    }

    // Check if shell is in whitelist (case-insensitive)
    const shellLower = shell.toLowerCase();
    const baseName = path.basename(shellLower);

    const isAllowed = allowedShells.some(
      (allowed) => allowed.toLowerCase() === shellLower || allowed.toLowerCase() === baseName
    );

    if (!isAllowed) {
      this.logger?.warn('Shell not in whitelist, using default', { shell });
      return this._getDefaultShell();
    }

    return shell;
  }

  _validateNumber(value, defaultValue, min, max) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < min || num > max) {
      return defaultValue;
    }
    return num;
  }
}

module.exports = SessionManager;
