// logger.js
// Advanced logging system for Shadow UI
// By: NathanGr33n

const fs = require('fs');
const path = require('path');
const os = require('os');

class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.logDir = options.logDir || path.join(os.homedir(), '.shadow-ui', 'logs');
    this.currentLogFile = null;
    this.fileStream = null;

    // Ensure log directory exists
    this.ensureLogDirectory();

    // Initialize file logging
    if (this.enableFile) {
      this.initializeFileLogging();
    }

    // Log levels hierarchy
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
      this.enableFile = false;
    }
  }

  initializeFileLogging() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.currentLogFile = path.join(this.logDir, `shadow-ui-${timestamp}.log`);

      // Rotate logs if needed
      this.rotateLogs();

      this.fileStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
      this.info('Logger initialized', { logFile: this.currentLogFile });
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
      this.enableFile = false;
    }
  }

  rotateLogs() {
    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter((file) => file.startsWith('shadow-ui-') && file.endsWith('.log'))
        .map((file) => ({
          name: file,
          path: path.join(this.logDir, file),
          stat: fs.statSync(path.join(this.logDir, file)),
        }))
        .sort((a, b) => b.stat.mtime - a.stat.mtime);

      // Remove old log files
      if (files.length >= this.maxFiles) {
        files.slice(this.maxFiles - 1).forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.warn('Failed to delete old log file:', file.name, error);
          }
        });
      }
    } catch (error) {
      console.error('Log rotation failed:', error);
    }
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const processInfo = {
      pid: process.pid,
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };

    return {
      timestamp,
      level: level.toUpperCase(),
      message,
      metadata,
      process: processInfo,
      memory: process.memoryUsage(),
    };
  }

  writeToFile(formattedLog) {
    if (!this.enableFile || !this.fileStream) {
      return;
    }

    try {
      const logLine = JSON.stringify(formattedLog) + '\n';
      this.fileStream.write(logLine);

      // Check file size and rotate if needed
      if (this.fileStream.bytesWritten > this.maxFileSize) {
        this.fileStream.end();
        this.initializeFileLogging();
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  writeToConsole(level, message, metadata) {
    if (!this.enableConsole) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${level.toUpperCase()}] ${timestamp}:`;

    const metaString = Object.keys(metadata).length > 0 ? ' ' + JSON.stringify(metadata) : '';

    switch (level) {
      case 'error':
        console.error(prefix, message + metaString);
        break;
      case 'warn':
        console.warn(prefix, message + metaString);
        break;
      case 'info':
        console.log(prefix, message + metaString);
        break;
      case 'debug':
        console.debug(prefix, message + metaString);
        break;
    }
  }

  log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    // Handle Error objects
    if (message instanceof Error) {
      metadata.stack = message.stack;
      metadata.name = message.name;
      message = message.message;
    }

    const formattedLog = this.formatMessage(level, message, metadata);

    // Write to console
    this.writeToConsole(level, message, metadata);

    // Write to file
    this.writeToFile(formattedLog);
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }

  // Performance logging
  time(label) {
    this._timers = this._timers || {};
    this._timers[label] = Date.now();
  }

  timeEnd(label) {
    this._timers = this._timers || {};
    if (this._timers[label]) {
      const duration = Date.now() - this._timers[label];
      delete this._timers[label];
      this.debug('Performance timing', { label, duration: `${duration}ms` });
      return duration;
    }
  }

  // System health check
  logSystemHealth() {
    const memUsage = process.memoryUsage();
    this.info('System health check', {
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      },
      uptime: `${Math.round(process.uptime())}s`,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      freemem: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
      totalmem: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
    });
  }

  // Cleanup
  close() {
    if (this.fileStream) {
      this.info('Closing log file stream');
      this.fileStream.end();
      this.fileStream = null;
    }
  }

  // Get recent logs (for debugging)
  getRecentLogs(count = 100) {
    if (!this.enableFile || !this.currentLogFile) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      const lines = content.trim().split('\n').slice(-count);
      return lines.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { message: line, level: 'UNKNOWN' };
        }
      });
    } catch (error) {
      this.error('Failed to read recent logs:', error);
      return [];
    }
  }
}

module.exports = Logger;
