// commandHistory.js
// Command history management for Shadow UI
// By: NathanGr33n

const Store = require('electron-store');
const os = require('os');

class CommandHistory {
  constructor(logger = null) {
    this.logger = logger;
    this.store = new Store({
      name: 'shadow-ui-command-history',
      cwd: os.homedir(),
    });
    
    // In-memory cache for performance
    this.history = this.store.get('commands', []);
    this.maxCommands = 1000; // Keep last 1000 commands
  }

  /**
   * Add a command to history
   * @param {string} command - The command text
   * @param {string} cwd - Current working directory
   */
  addCommand(command, cwd = process.cwd()) {
    if (!command || typeof command !== 'string') {
      return false;
    }

    // Trim and skip empty commands
    const trimmed = command.trim();
    if (trimmed.length === 0) {
      return false;
    }

    // Skip duplicate consecutive commands
    if (this.history.length > 0) {
      const lastCommand = this.history[this.history.length - 1];
      if (lastCommand.command === trimmed) {
        return false;
      }
    }

    const entry = {
      command: trimmed,
      cwd: cwd || process.cwd(),
      timestamp: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.history.push(entry);

    // Trim to max size
    if (this.history.length > this.maxCommands) {
      this.history = this.history.slice(-this.maxCommands);
    }

    // Persist to disk
    this.save();

    if (this.logger) {
      this.logger.debug('Command added to history', { command: trimmed });
    }

    return true;
  }

  /**
   * Get all commands in history
   * @param {number} limit - Maximum number of commands to return
   * @returns {Array} Array of command entries
   */
  getHistory(limit = null) {
    const commands = [...this.history];
    if (limit && limit > 0) {
      return commands.slice(-limit);
    }
    return commands;
  }

  /**
   * Search command history
   * @param {string} query - Search query
   * @returns {Array} Matching command entries
   */
  search(query) {
    if (!query || typeof query !== 'string') {
      return this.history;
    }

    const lowerQuery = query.toLowerCase();
    return this.history.filter(entry => 
      entry.command.toLowerCase().includes(lowerQuery) ||
      entry.cwd.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Clear all command history
   */
  clear() {
    this.history = [];
    this.save();
    
    if (this.logger) {
      this.logger.info('Command history cleared');
    }
  }

  /**
   * Save history to disk
   */
  save() {
    try {
      this.store.set('commands', this.history);
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to save command history', error);
      }
      return false;
    }
  }

  /**
   * Get history statistics
   * @returns {Object} Statistics about command history
   */
  getStats() {
    return {
      totalCommands: this.history.length,
      oldestCommand: this.history.length > 0 ? this.history[0].timestamp : null,
      newestCommand: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null,
    };
  }
}

module.exports = CommandHistory;
