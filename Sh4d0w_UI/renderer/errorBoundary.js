// errorBoundary.js
// Client-side error handling and recovery for Shadow UI
// By: NathanGr33n

class RendererErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.lastErrors = [];
    this.debugMode = localStorage.getItem('shadow-ui-debug') === 'true';
    
    this.setupErrorHandlers();
    this.setupDebugTools();
    
    if (this.debugMode) {
      console.log('[Shadow UI] Debug mode enabled');
      this.createDebugPanel();
    }
  }

  setupErrorHandlers() {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'javascript',
        timestamp: Date.now()
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        message: event.reason?.message || event.reason?.toString() || 'Unhandled Promise Rejection',
        error: event.reason,
        type: 'promise',
        timestamp: Date.now()
      });
    });

    // Console error override
    const originalError = console.error;
    console.error = (...args) => {
      this.handleError({
        message: args.join(' '),
        type: 'console',
        timestamp: Date.now(),
        args
      });
      originalError.apply(console, args);
    };
  }

  handleError(errorData) {
    this.errorCount++;
    
    // Add to recent errors (keep last 50)
    this.lastErrors.push(errorData);
    if (this.lastErrors.length > 50) {
      this.lastErrors.shift();
    }

    // Log to console in debug mode
    if (this.debugMode) {
      console.group(`[Shadow UI Error #${this.errorCount}]`);
      console.error('Error Details:', errorData);
      console.error('Stack Trace:', errorData.error?.stack);
      console.groupEnd();
    }

    // Send to main process if IPC is available
    if (window.edex?.sendError) {
      window.edex.sendError(errorData);
    }

    // Try to recover from certain errors
    this.attemptRecovery(errorData);

    return errorData;
  }

  attemptRecovery(errorData) {
    // Terminal recovery
    if (errorData.message.includes('terminal') || errorData.message.includes('xterm')) {
      console.warn('[Shadow UI] Attempting terminal recovery...');
      setTimeout(() => {
        this.recoverTerminal();
      }, 1000);
    }

    // Stats display recovery
    if (errorData.message.includes('stats') || errorData.message.includes('monitoring')) {
      console.warn('[Shadow UI] Attempting stats recovery...');
      this.recoverStats();
    }

    // UI component recovery
    if (errorData.message.includes('renderer')) {
      console.warn('[Shadow UI] Attempting UI recovery...');
      this.recoverUI();
    }
  }

  recoverTerminal() {
    try {
      const terminalEl = document.getElementById('terminal');
      if (terminalEl && !terminalEl.querySelector('.xterm')) {
        // Terminal seems broken, try to reinitialize
        if (window.term && window.edex?.sendTermInit) {
          window.edex.sendTermInit({ cols: 120, rows: 32 });
          console.log('[Shadow UI] Terminal recovery attempted');
        }
      }
    } catch (error) {
      console.error('[Shadow UI] Terminal recovery failed:', error);
    }
  }

  recoverStats() {
    try {
      // Check if stats elements exist and are updating
      const statsElements = ['host', 'os', 'cpuload', 'mem'];
      let recoveryNeeded = false;

      statsElements.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.textContent === '-' || el.textContent === '') {
          recoveryNeeded = true;
        }
      });

      if (recoveryNeeded) {
        console.log('[Shadow UI] Stats recovery attempted - requesting fresh data');
        // The stats will recover automatically on next poll
      }
    } catch (error) {
      console.error('[Shadow UI] Stats recovery failed:', error);
    }
  }

  recoverUI() {
    try {
      // Check critical UI elements and restore if missing
      const criticalElements = [
        { id: 'clock', fallback: 'Clock unavailable' },
        { id: 'host', fallback: 'Unknown Host' },
        { id: 'os', fallback: 'Unknown OS' }
      ];

      criticalElements.forEach(({ id, fallback }) => {
        const el = document.getElementById(id);
        if (!el) {
          // Element is missing, try to recreate or show fallback
          console.warn(`[Shadow UI] Missing element: ${id}`);
        } else if (el.textContent === '') {
          el.textContent = fallback;
        }
      });

      console.log('[Shadow UI] UI recovery attempted');
    } catch (error) {
      console.error('[Shadow UI] UI recovery failed:', error);
    }
  }

  // Safe wrapper for async operations
  async safeAsync(operation, fallback = null, context = 'async operation') {
    try {
      return await operation();
    } catch (error) {
      this.handleError({
        message: `Safe async wrapper caught error in ${context}`,
        error,
        type: 'safe-async',
        timestamp: Date.now(),
        context
      });
      return fallback;
    }
  }

  // Safe wrapper for sync operations
  safe(operation, fallback = null, context = 'sync operation') {
    try {
      return operation();
    } catch (error) {
      this.handleError({
        message: `Safe wrapper caught error in ${context}`,
        error,
        type: 'safe-sync',
        timestamp: Date.now(),
        context
      });
      return fallback;
    }
  }

  // Performance tracking
  startTiming(label) {
    this._timings = this._timings || {};
    this._timings[label] = performance.now();
  }

  endTiming(label) {
    this._timings = this._timings || {};
    if (this._timings[label]) {
      const duration = performance.now() - this._timings[label];
      delete this._timings[label];
      
      if (this.debugMode) {
        console.log(`[Shadow UI Timing] ${label}: ${duration.toFixed(2)}ms`);
      }
      
      // Log slow operations
      if (duration > 100) {
        this.handleError({
          message: `Slow operation detected: ${label}`,
          type: 'performance',
          timestamp: Date.now(),
          duration,
          label
        });
      }
      
      return duration;
    }
    return 0;
  }

  // Debug tools
  setupDebugTools() {
    // Add global debug functions
    window.shadowDebug = {
      getErrors: () => this.lastErrors,
      getErrorCount: () => this.errorCount,
      clearErrors: () => {
        this.lastErrors = [];
        this.errorCount = 0;
        console.log('[Shadow UI] Error log cleared');
      },
      enableDebug: () => {
        localStorage.setItem('shadow-ui-debug', 'true');
        this.debugMode = true;
        console.log('[Shadow UI] Debug mode enabled');
        this.createDebugPanel();
      },
      disableDebug: () => {
        localStorage.removeItem('shadow-ui-debug');
        this.debugMode = false;
        console.log('[Shadow UI] Debug mode disabled');
        this.removeDebugPanel();
      },
      getSystemInfo: () => ({
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        memory: performance.memory,
        timing: performance.timing,
        errors: this.lastErrors.slice(-10)
      }),
      testError: () => {
        throw new Error('[Shadow UI Debug] Test error for debugging purposes');
      }
    };
  }

  createDebugPanel() {
    if (document.getElementById('shadow-debug-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'shadow-debug-panel';
    panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      max-height: 200px;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border: 1px solid #00ff00;
      border-radius: 4px;
      z-index: 10000;
      overflow-y: auto;
      pointer-events: none;
    `;

    const update = () => {
      const recentErrors = this.lastErrors.slice(-3);
      panel.innerHTML = `
        <div>Errors: ${this.errorCount}</div>
        <div>Memory: ${Math.round(performance.memory?.usedJSHeapSize / 1024 / 1024) || '?'}MB</div>
        <div>Recent Errors:</div>
        ${recentErrors.map(e => `<div style="font-size: 10px;">• ${e.type}: ${e.message.substring(0, 40)}${e.message.length > 40 ? '...' : ''}</div>`).join('')}
      `;
    };

    document.body.appendChild(panel);
    update();
    
    // Update every 5 seconds
    this.debugInterval = setInterval(update, 5000);
  }

  removeDebugPanel() {
    const panel = document.getElementById('shadow-debug-panel');
    if (panel) {
      panel.remove();
    }
    if (this.debugInterval) {
      clearInterval(this.debugInterval);
      this.debugInterval = null;
    }
  }

  // Cleanup
  destroy() {
    this.removeDebugPanel();
    if (this.debugInterval) {
      clearInterval(this.debugInterval);
    }
    delete window.shadowDebug;
  }
}

// Initialize error handler when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.rendererErrorHandler = new RendererErrorHandler();
  });
} else {
  window.rendererErrorHandler = new RendererErrorHandler();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RendererErrorHandler;
}
