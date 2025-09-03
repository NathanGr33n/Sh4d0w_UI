// errorHandler.js
// Comprehensive error handling and performance monitoring
// By: NathanGr33n

const fs = require('fs');
const path = require('path');
const os = require('os');

class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
    this.errorCount = 0;
    this.crashCount = 0;
    this.performanceMetrics = {
      startTime: Date.now(),
      errors: [],
      warnings: [],
      performance: []
    };
    this.healthCheckInterval = null;
    this.crashReportDir = path.join(os.homedir(), '.shadow-ui', 'crashes');
    
    this.ensureCrashReportDirectory();
    this.setupGlobalErrorHandlers();
    this.startHealthMonitoring();
  }

  ensureCrashReportDirectory() {
    try {
      if (!fs.existsSync(this.crashReportDir)) {
        fs.mkdirSync(this.crashReportDir, { recursive: true });
      }
    } catch (error) {
      this.logger.error('Failed to create crash report directory', error);
    }
  }

  setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error, origin) => {
      this.handleCriticalError('Uncaught Exception', error, { origin });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleCriticalError('Unhandled Promise Rejection', reason, { promise: promise.toString() });
    });

    // Handle warnings
    process.on('warning', (warning) => {
      this.handleWarning(warning);
    });

    // Memory warnings
    process.on('SIGTERM', () => {
      this.logger.info('Received SIGTERM, gracefully shutting down');
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      this.logger.info('Received SIGINT, gracefully shutting down');
      this.cleanup();
      process.exit(0);
    });
  }

  handleCriticalError(type, error, metadata = {}) {
    this.crashCount++;
    
    const errorData = {
      type,
      message: error.message || error.toString(),
      stack: error.stack || new Error().stack,
      timestamp: new Date().toISOString(),
      metadata,
      system: this.getSystemInfo(),
      performance: this.getPerformanceSnapshot()
    };

    this.logger.error(`Critical Error: ${type}`, errorData);
    this.generateCrashReport(errorData);
    
    // If too many crashes, exit
    if (this.crashCount >= 5) {
      this.logger.error('Too many crashes detected, exiting application');
      this.cleanup();
      process.exit(1);
    }
  }

  handleError(error, context = '', metadata = {}) {
    this.errorCount++;
    
    const errorData = {
      message: error.message || error.toString(),
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      metadata,
      count: this.errorCount
    };

    this.performanceMetrics.errors.push(errorData);
    
    // Keep only last 100 errors in memory
    if (this.performanceMetrics.errors.length > 100) {
      this.performanceMetrics.errors = this.performanceMetrics.errors.slice(-100);
    }

    this.logger.error(`Application Error [${context}]`, errorData);
    
    return errorData;
  }

  handleWarning(warning, metadata = {}) {
    const warningData = {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.performanceMetrics.warnings.push(warningData);
    
    // Keep only last 50 warnings in memory
    if (this.performanceMetrics.warnings.length > 50) {
      this.performanceMetrics.warnings = this.performanceMetrics.warnings.slice(-50);
    }

    this.logger.warn('Application Warning', warningData);
    
    return warningData;
  }

  // Wrap async functions with error handling
  wrapAsync(fn, context = 'async operation') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, context, { args: args.slice(0, 2) }); // Limit args logging
        throw error;
      }
    };
  }

  // Wrap sync functions with error handling
  wrapSync(fn, context = 'sync operation') {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, context, { args: args.slice(0, 2) }); // Limit args logging
        throw error;
      }
    };
  }

  // Safe function execution with fallback
  safeExecute(fn, fallback = null, context = 'safe execution') {
    try {
      return fn();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  // Safe async function execution with fallback
  async safeExecuteAsync(fn, fallback = null, context = 'safe async execution') {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error, context);
      return fallback;
    }
  }

  // Performance tracking
  trackPerformance(label, duration, metadata = {}) {
    const perfData = {
      label,
      duration,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.performanceMetrics.performance.push(perfData);
    
    // Keep only last 200 performance entries
    if (this.performanceMetrics.performance.length > 200) {
      this.performanceMetrics.performance = this.performanceMetrics.performance.slice(-200);
    }

    // Log slow operations
    if (duration > 1000) { // More than 1 second
      this.logger.warn('Slow operation detected', perfData);
    } else if (duration > 100) { // More than 100ms
      this.logger.debug('Performance timing', perfData);
    }

    return perfData;
  }

  // Memory monitoring
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    const memoryData = {
      process: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      system: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percentUsed: (usedMem / totalMem) * 100
      }
    };

    // Log memory warnings
    if (memoryData.process.heapUsed > 100 * 1024 * 1024) { // 100MB
      this.logger.warn('High memory usage detected', memoryData);
    }

    if (memoryData.system.percentUsed > 90) {
      this.logger.warn('System memory critical', memoryData);
    }

    return memoryData;
  }

  // Health monitoring
  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  performHealthCheck() {
    const health = {
      uptime: process.uptime(),
      memory: this.checkMemoryUsage(),
      errors: this.errorCount,
      crashes: this.crashCount,
      timestamp: new Date().toISOString()
    };

    this.logger.debug('Health check', health);

    // Alert on high error rate
    if (this.errorCount > 50) {
      this.logger.warn('High error count detected', { errorCount: this.errorCount });
    }

    return health;
  }

  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      pid: process.pid,
      uptime: process.uptime(),
      cwd: process.cwd(),
      execPath: process.execPath
    };
  }

  getPerformanceSnapshot() {
    return {
      errors: this.performanceMetrics.errors.length,
      warnings: this.performanceMetrics.warnings.length,
      performanceEntries: this.performanceMetrics.performance.length,
      uptime: Date.now() - this.performanceMetrics.startTime,
      memory: process.memoryUsage()
    };
  }

  generateCrashReport(errorData) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const crashFile = path.join(this.crashReportDir, `crash-${timestamp}.json`);
      
      const crashReport = {
        ...errorData,
        recentErrors: this.performanceMetrics.errors.slice(-10),
        recentWarnings: this.performanceMetrics.warnings.slice(-5),
        recentPerformance: this.performanceMetrics.performance.slice(-20)
      };

      fs.writeFileSync(crashFile, JSON.stringify(crashReport, null, 2));
      this.logger.info('Crash report generated', { crashFile });
    } catch (error) {
      this.logger.error('Failed to generate crash report', error);
    }
  }

  // Get metrics for debugging
  getMetrics() {
    return {
      errors: this.errorCount,
      crashes: this.crashCount,
      uptime: Date.now() - this.performanceMetrics.startTime,
      recentErrors: this.performanceMetrics.errors.slice(-10),
      recentWarnings: this.performanceMetrics.warnings.slice(-5),
      recentPerformance: this.performanceMetrics.performance.slice(-10)
    };
  }

  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    this.logger.info('Error handler cleanup completed');
  }
}

module.exports = ErrorHandler;
