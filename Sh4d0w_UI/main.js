// main.js
// By: NathanGr33n
// August 2025

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const os = require('os');
// Use compiled TypeScript config if available, fallback to JS
const config = require(
  require('fs').existsSync(path.join(__dirname, 'dist', 'config.js')) ? './dist/config' : './config'
);
const Logger = require('./logger');
const ErrorHandler = require('./errorHandler');
const SessionManager = require('./sessionManager');
const CommandHistory = require('./commandHistory');

// Initialize advanced logging system
const securityConfig = config.getSecurityConfig();
const logger = new Logger({
  logLevel: securityConfig.logLevel,
  enableConsole: true,
  enableFile: securityConfig.enableLogging,
});

// Initialize error handler
const errorHandler = new ErrorHandler(logger);

// Initialize session manager for terminal persistence
const sessionManager = new SessionManager(logger);

// Initialize command history manager
const commandHistory = new CommandHistory(logger);

// Convenience logging functions
const log = {
  info: (msg, meta) => logger.info(msg, meta),
  warn: (msg, meta) => logger.warn(msg, meta),
  error: (msg, meta) => logger.error(msg, meta),
  debug: (msg, meta) => logger.debug(msg, meta),
  time: (label) => logger.time(label),
  timeEnd: (label) => logger.timeEnd(label),
  health: () => logger.logSystemHealth(),
};

// Prefer the actively maintained prebuilt fork
let pty;
try {
  pty = require('@homebridge/node-pty-prebuilt-multiarch');
} catch {
  try {
    pty = require('node-pty-prebuilt-multiarch');
  } catch {
    // legacy
    pty = require('node-pty');
  } // fallback to source build
}

const si = require('systeminformation');
const { RateLimiter } = require('limiter');

let mainWindow;
let shellPty;
let statsInterval;
let isShuttingDown = false;

// Window state tracking for adaptive polling
let isWindowMinimized = false;
let isWindowFocused = true;

// Terminal session state for persistence
let currentSession = {
  cwd: process.cwd(),
  shell: process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash',
  cols: 120,
  rows: 32,
};

// Rate limiting for system monitoring - now configurable
const monitoringConfig = config.getMonitoringConfig();
const STATS_INTERVAL = monitoringConfig.pollInterval;
const MAX_RETRIES = monitoringConfig.maxRetries;
let statsRetryCount = 0;

// Security: IPC Rate limiters to prevent DoS attacks
const rateLimiters = {
  termWrite: new RateLimiter({ tokensPerInterval: 100, interval: 'second' }),
  termResize: new RateLimiter({ tokensPerInterval: 10, interval: 'second' }),
  termInit: new RateLimiter({ tokensPerInterval: 5, interval: 'minute' }),
  debugCommand: new RateLimiter({ tokensPerInterval: 5, interval: 'minute' }),
  rendererError: new RateLimiter({ tokensPerInterval: 50, interval: 'minute' }),
};

// Security: Set up Content Security Policy
function setupSecurity() {
  const defaultSession = session.defaultSession;

  // CSP Header - Removed unsafe-inline for better XSS protection
  // Note: Google Fonts requires some inline styles, kept for compatibility
  // CDN scripts now require SRI hashes in HTML
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' https://cdn.jsdelivr.net;",
          "style-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline';",
          "font-src 'self' https://fonts.gstatic.com;",
          "connect-src 'self';",
          "img-src 'self' data:;",
          "media-src 'none';",
          "object-src 'none';",
          "frame-src 'none';".replace(/;\s*/g, '; '),
        ],
      },
    });
  });

  // Block external navigation
  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (
      url.protocol === 'file:' ||
      url.hostname === 'cdn.jsdelivr.net' ||
      url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com'
    ) {
      callback({});
    } else {
      log.warn('Blocked external request:', details.url);
      callback({ cancel: true });
    }
  });
}

function createWindow() {
  try {
    const windowConfig = config.getWindowConfig();
    mainWindow = new BrowserWindow({
      width: windowConfig.width,
      height: windowConfig.height,
      backgroundColor: windowConfig.backgroundColor,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        webSecurity: true,
        sandbox: false, // Keep false for now due to node-pty requirements
      },
      autoHideMenuBar: true,
      show: false, // Don't show until ready
    });

    // Security: Prevent new window creation
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    // Security: Prevent navigation to external URLs
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== 'file://') {
        event.preventDefault();
        log.warn('Blocked navigation to:', navigationUrl);
      }
    });

    // Show window when ready to prevent flash
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      
      // Apply saved zoom level
      try {
        const uiConfig = config.getUIConfig();
        const zoomLevel = uiConfig.zoomLevel || 1.0;
        if (zoomLevel !== 1.0) {
          mainWindow.webContents.setZoomFactor(zoomLevel);
          log.info('Applied saved zoom level:', zoomLevel);
        }
      } catch (error) {
        log.warn('Failed to apply zoom level:', error);
      }
      
      log.info('Window ready and shown');
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null;
      cleanup();
    });

    // Track window state for adaptive polling
    mainWindow.on('minimize', () => {
      isWindowMinimized = true;
      log.debug('Window minimized, adaptive polling may activate');
    });

    mainWindow.on('restore', () => {
      isWindowMinimized = false;
      log.debug('Window restored, resuming normal polling');
    });

    mainWindow.on('focus', () => {
      isWindowFocused = true;
    });

    mainWindow.on('blur', () => {
      isWindowFocused = false;
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((err) => {
      log.error('Failed to load main window:', err);
    });
  } catch (error) {
    log.error('Failed to create window:', error);
    app.quit();
  }
}

// Input validation helpers
function validateSize(size) {
  return (
    size &&
    typeof size.cols === 'number' &&
    size.cols > 0 &&
    size.cols <= 500 &&
    typeof size.rows === 'number' &&
    size.rows > 0 &&
    size.rows <= 200
  );
}

function sanitizeTerminalData(data) {
  if (typeof data !== 'string') {
    return '';
  }

  // Limit length to prevent memory exhaustion
  let sanitized = data.slice(0, 10000);

  // Security: Filter dangerous terminal escape sequences
  // Remove OSC (Operating System Command) sequences that could be exploited
  // OSC sequences: ESC ] ... ESC \ or ESC ] ... BEL
  sanitized = sanitized.replace(/\x1b\][^\x1b\x07]*[\x1b\x07]/g, '');

  // Remove CSI sequences that could manipulate terminal state unsafely
  // Block window manipulation sequences (CSI t)
  sanitized = sanitized.replace(/\x1b\[[0-9;]*t/g, '');

  // Remove PM (Privacy Message) and APC (Application Program Command) sequences
  sanitized = sanitized.replace(/\x1b[_^][^\x1b]*\x1b\\/g, '');

  // Remove potentially dangerous DCS (Device Control String) sequences
  sanitized = sanitized.replace(/\x1bP[^\x1b]*\x1b\\/g, '');

  return sanitized;
}

// Resource cleanup with enhanced error handling
// Prevents memory leaks by properly disposing of all resources
function cleanup() {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  log.time('cleanup');
  log.info('Starting cleanup...');

  // Stop health monitoring
  if (errorHandler) {
    errorHandler.cleanup();
  }

  // Save terminal session before cleanup
  if (sessionManager && shellPty) {
    try {
      sessionManager.saveSession(currentSession);
    } catch (err) {
      log.error('Failed to save terminal session:', err);
    }
  }

  // Clear stats interval
  if (statsInterval) {
    clearTimeout(statsInterval);
    statsInterval = null;
  }

  // Kill shell process and free memory
  if (shellPty) {
    try {
      shellPty.kill();
      shellPty = null;
      log.info('Terminal process cleaned up');
    } catch (err) {
      errorHandler.handleError(err, 'cleanup-shell');
    }
  }

  // Remove all IPC listeners to prevent memory leaks
  // Note: IPC handlers are automatically cleaned up on app quit,
  // but we explicitly clear them here for clarity
  ipcMain.removeAllListeners('term:init');
  ipcMain.removeAllListeners('term:resize');
  ipcMain.removeAllListeners('term:write');
  ipcMain.removeAllListeners('renderer:error');
  ipcMain.removeAllListeners('debug:command');

  log.timeEnd('cleanup');
  log.info('Cleanup completed');

  // Close logger LAST to ensure all logs are written
  if (logger) {
    logger.close();
  }
}

function startShell(cols = 120, rows = 32, cwd = null, shell = null) {
  try {
    if (shellPty) {
      log.warn('Shell already running, skipping initialization');
      return;
    }

    // Use provided shell or default
    const shellToUse =
      shell || (process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash');

    // Use provided cwd or current working directory
    const cwdToUse = cwd || process.cwd();

    log.info(`Starting shell: ${shellToUse} (${cols}x${rows}) in ${cwdToUse}`);

    // Update current session state
    currentSession = {
      cwd: cwdToUse,
      shell: shellToUse,
      cols,
      rows,
    };

    // Security: Whitelist only safe environment variables
    // Do NOT pass sensitive vars like AWS_*, GITHUB_TOKEN, NPM_TOKEN, etc.
    const safeEnv = {
      TERM_PROGRAM: 'ShadowUI',
      HOME: process.env.HOME || process.env.USERPROFILE || '',
      USER: process.env.USER || process.env.USERNAME || '',
      SHELL: process.env.SHELL || '',
      PATH: process.env.PATH || '',
      LANG: process.env.LANG || process.env.LANGUAGE || 'en_US.UTF-8',
      TERM: process.env.TERM || 'xterm-color',
      COLORTERM: process.env.COLORTERM || '',
      // Windows-specific
      SYSTEMROOT: process.env.SYSTEMROOT || '',
      WINDIR: process.env.WINDIR || '',
      LOCALAPPDATA: process.env.LOCALAPPDATA || '',
      APPDATA: process.env.APPDATA || '',
      TEMP: process.env.TEMP || process.env.TMP || '',
      TMP: process.env.TMP || process.env.TEMP || '',
      // Unix-specific
      LOGNAME: process.env.LOGNAME || '',
      PWD: cwdToUse,
    };

    shellPty = pty.spawn(shellToUse, [], {
      name: 'xterm-color',
      cols: Math.max(1, Math.min(500, cols)),
      rows: Math.max(1, Math.min(200, rows)),
      cwd: cwdToUse,
      env: safeEnv,
    });

    shellPty.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('term:data', data);
      }
    });

    shellPty.onExit((code, signal) => {
      log.info(`Shell exited with code ${code}, signal ${signal}`);
      shellPty = null;
    });
  } catch (error) {
    log.error('Failed to start shell:', error);
    shellPty = null;
  }
}

// Enhanced IPC handlers with validation and rate limiting
ipcMain.on('term:init', async (_evt, size) => {
  try {
    // Rate limiting
    const remaining = await rateLimiters.termInit.removeTokens(1);
    if (remaining < 0) {
      log.warn('Terminal init rate limit exceeded');
      return;
    }

    if (!shellPty) {
      // Try to restore previous session
      const savedSession = sessionManager.loadLastSession();

      const validSize = validateSize(size);
      const cols = validSize ? size.cols : savedSession?.cols || 120;
      const rows = validSize ? size.rows : savedSession?.rows || 32;
      const cwd = savedSession?.cwd || null;
      const shell = savedSession?.shell || null;

      if (savedSession) {
        log.info('Restoring previous terminal session');
      }

      startShell(cols, rows, cwd, shell);
    }
  } catch (error) {
    log.error('Error in term:init handler:', error);
  }
});

ipcMain.on('term:resize', (_evt, size) => {
  try {
    if (shellPty && validateSize(size)) {
      shellPty.resize(size.cols, size.rows);
      // Update session state
      currentSession.cols = size.cols;
      currentSession.rows = size.rows;
      log.info(`Terminal resized to ${size.cols}x${size.rows}`);
    } else {
      log.warn('Invalid resize parameters or no terminal');
    }
  } catch (error) {
    log.error('Error resizing terminal:', error);
  }
});

ipcMain.on('term:write', async (_evt, data) => {
  try {
    // Rate limiting
    const remaining = await rateLimiters.termWrite.removeTokens(1);
    if (remaining < 0) {
      log.warn('Terminal write rate limit exceeded');
      return;
    }

    if (shellPty) {
      const sanitizedData = sanitizeTerminalData(data);
      shellPty.write(sanitizedData);
      
      // Track commands (detect Enter key)
      if (data === '\r') {
        // Command was executed - extract from terminal buffer would be complex
        // Instead, we'll track this via a separate IPC for command tracking
      }
    }
  } catch (error) {
    errorHandler.handleError(error, 'term:write');
  }
});

// Renderer error reporting
ipcMain.on('renderer:error', async (_evt, errorData) => {
  try {
    // Rate limiting
    const remaining = await rateLimiters.rendererError.removeTokens(1);
    if (remaining < 0) {
      log.warn('Renderer error reporting rate limit exceeded');
      return;
    }

    errorHandler.handleError(new Error(errorData.message), 'renderer', {
      ...errorData,
      source: 'renderer-process',
    });
  } catch (error) {
    log.error('Error handling renderer error:', error);
  }
});

// Debug info handler - Only available in development mode
ipcMain.handle('debug:get-info', async () => {
  // Security: Restrict debug commands to development mode
  if (app.isPackaged) {
    log.warn('Debug command attempted in production mode');
    return { error: 'Debug commands disabled in production' };
  }

  return {
    metrics: errorHandler.getMetrics(),
    systemHealth: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    },
    recentLogs: logger.getRecentLogs(20),
  };
});

// Configuration IPC handlers
ipcMain.handle('config:get', async (_evt, key) => {
  try {
    return config.get(key);
  } catch (error) {
    log.error('Config get error:', error);
    return null;
  }
});

ipcMain.handle('config:set', async (_evt, key, value) => {
  try {
    const success = config.set(key, value);
    if (success) {
      log.info('Config updated:', { key, value });
      
      // Apply dynamic changes
      if (key === 'monitoring.pollInterval' || key.startsWith('monitoring.')) {
        // Restart polling with new settings
        if (statsInterval) {
          clearTimeout(statsInterval);
          statsInterval = null;
        }
        pollStats();
      }
    }
    return success;
  } catch (error) {
    log.error('Config set error:', error);
    return false;
  }
});

ipcMain.handle('config:reset', async () => {
  try {
    const success = config.reset();
    if (success) {
      log.info('Config reset to defaults');
      // Restart polling with default settings
      if (statsInterval) {
        clearTimeout(statsInterval);
        statsInterval = null;
      }
      pollStats();
    }
    return success;
  } catch (error) {
    log.error('Config reset error:', error);
    return false;
  }
});

// Zoom control handlers
ipcMain.handle('zoom:set', async (_evt, zoomLevel) => {
  try {
    // Validate zoom level (0.5 to 2.0)
    const level = Math.max(0.5, Math.min(2.0, Number(zoomLevel)));
    if (isNaN(level)) {
      log.warn('Invalid zoom level provided:', zoomLevel);
      return false;
    }
    
    const success = config.set('ui.zoomLevel', level);
    if (success && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomFactor(level);
      log.info('Zoom level set to:', level);
    }
    return success;
  } catch (error) {
    log.error('Zoom set error:', error);
    return false;
  }
});

ipcMain.handle('zoom:get', async () => {
  try {
    const uiConfig = config.getUIConfig();
    return uiConfig.zoomLevel || 1.0;
  } catch (error) {
    log.error('Zoom get error:', error);
    return 1.0;
  }
});

ipcMain.handle('zoom:reset', async () => {
  try {
    const success = config.set('ui.zoomLevel', 1.0);
    if (success && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.setZoomFactor(1.0);
      log.info('Zoom level reset to 1.0');
    }
    return success;
  } catch (error) {
    log.error('Zoom reset error:', error);
    return false;
  }
});

// Command history handlers
ipcMain.handle('history:add', async (_evt, command) => {
  try {
    if (!command || typeof command !== 'string') {
      return false;
    }
    return commandHistory.addCommand(command, currentSession.cwd);
  } catch (error) {
    log.error('Failed to add command to history:', error);
    return false;
  }
});

ipcMain.handle('history:get', async (_evt, limit) => {
  try {
    return commandHistory.getHistory(limit);
  } catch (error) {
    log.error('Failed to get command history:', error);
    return [];
  }
});

ipcMain.handle('history:search', async (_evt, query) => {
  try {
    return commandHistory.search(query);
  } catch (error) {
    log.error('Failed to search command history:', error);
    return [];
  }
});

ipcMain.handle('history:clear', async () => {
  try {
    commandHistory.clear();
    return true;
  } catch (error) {
    log.error('Failed to clear command history:', error);
    return false;
  }
});

ipcMain.handle('history:stats', async () => {
  try {
    return commandHistory.getStats();
  } catch (error) {
    log.error('Failed to get history stats:', error);
    return { totalCommands: 0, oldestCommand: null, newestCommand: null };
  }
});

// Theme handlers
ipcMain.handle('theme:set', async (_evt, themeName) => {
  try {
    if (!themeName || typeof themeName !== 'string') {
      return false;
    }
    const success = config.set('theme.current', themeName);
    if (success) {
      log.info('Theme changed to:', themeName);
    }
    return success;
  } catch (error) {
    log.error('Failed to set theme:', error);
    return false;
  }
});

ipcMain.handle('theme:get', async () => {
  try {
    const themeConfig = config.getThemeConfig();
    return themeConfig.current || 'shadow';
  } catch (error) {
    log.error('Failed to get theme:', error);
    return 'shadow';
  }
});

// Debug command handler - Only available in development mode
ipcMain.on('debug:command', async (_evt, command) => {
  try {
    // Security: Restrict debug commands to development mode
    if (app.isPackaged) {
      log.warn('Debug command attempted in production mode', { command: command.type });
      return;
    }

    // Rate limiting
    const remaining = await rateLimiters.debugCommand.removeTokens(1);
    if (remaining < 0) {
      log.warn('Debug command rate limit exceeded');
      return;
    }

    switch (command.type) {
      case 'health-check':
        logger.logSystemHealth();
        break;
      case 'clear-errors':
        errorHandler.errorCount = 0;
        errorHandler.performanceMetrics.errors = [];
        log.info('Error count reset by debug command');
        break;
      case 'memory-info':
        log.info('Memory check requested', process.memoryUsage());
        break;
      default:
        log.warn('Unknown debug command:', command);
    }
  } catch (error) {
    errorHandler.handleError(error, 'debug:command');
  }
});

// Enhanced stats polling with error handling, rate limiting, and adaptive polling
async function pollStats() {
  if (isShuttingDown || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  // Get monitoring config for adaptive polling and selective metrics
  const monConfig = config.getMonitoringConfig();
  const enabledMetrics = monConfig.enabledMetrics;

  try {
    // Conditionally fetch only enabled metrics to reduce overhead
    const promises = [];
    
    promises.push(enabledMetrics.cpu ? si.currentLoad().catch(() => ({ currentLoad: 0, cpus: [] })) : Promise.resolve({ currentLoad: 0, cpus: [] }));
    promises.push(enabledMetrics.memory ? si.mem().catch(() => ({ total: 0, free: 0, active: 0 })) : Promise.resolve({ total: 0, free: 0, active: 0 }));
    promises.push(enabledMetrics.network ? si.networkStats().catch(() => []) : Promise.resolve([]));
    promises.push(enabledMetrics.disk ? si.fsSize().catch(() => []) : Promise.resolve([]));
    promises.push(enabledMetrics.battery && monConfig.enableBatteryMonitoring ? si.battery().catch(() => ({ hasbattery: false })) : Promise.resolve({ hasbattery: false }));
    promises.push(enabledMetrics.temperature && monConfig.enableTemperatureMonitoring ? si.cpuTemperature().catch(() => ({ main: null })) : Promise.resolve({ main: null }));

    const [cpu, mem, net, disk, bat, temp] = await Promise.all(promises);

    const payload = {
      time: Date.now(),
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      cpu: {
        avgLoad: Math.max(0, Math.min(100, cpu.currentLoad || 0)),
        cores: (cpu.cpus || []).map((c) => Math.max(0, Math.min(100, c.load || 0))),
      },
      mem: {
        total: Math.max(0, mem.total || 0),
        free: Math.max(0, mem.free || 0),
        used: Math.max(0, mem.active || 0),
      },
      net: (net || []).slice(0, 10).map((n) => ({
        iface: String(n.iface || 'unknown').slice(0, 50),
        rx: Math.max(0, n.rx_bytes || 0),
        tx: Math.max(0, n.tx_bytes || 0),
        rx_sec: Math.max(0, n.rx_sec || 0),
        tx_sec: Math.max(0, n.tx_sec || 0),
      })),
      disks: (disk || []).slice(0, 20).map((d) => ({
        fs: String(d.fs || 'unknown').slice(0, 100),
        used: Math.max(0, d.used || 0),
        size: Math.max(0, d.size || 0),
        mount: String(d.mount || 'unknown').slice(0, 200),
      })),
      battery: bat || { hasbattery: false },
      temperature: temp || { main: null },
    };

    mainWindow.webContents.send('stats:update', payload);
    statsRetryCount = 0; // Reset retry count on success
  } catch (error) {
    log.error('Stats polling error:', error);
    statsRetryCount++;

    if (statsRetryCount >= MAX_RETRIES) {
      log.error(`Stats polling failed ${MAX_RETRIES} times, backing off`);
      statsRetryCount = 0;
      // Increase interval temporarily and return to prevent double scheduling
      if (!isShuttingDown) {
        statsInterval = setTimeout(pollStats, STATS_INTERVAL * 5);
      }
      return;
    }
  }

  // Schedule next poll with adaptive interval (only reached if no backoff)
  if (!isShuttingDown) {
    // Adaptive polling: use slower interval when window is minimized
    let nextInterval = STATS_INTERVAL;
    
    if (monConfig.adaptivePolling && monConfig.slowPollWhenMinimized && isWindowMinimized) {
      nextInterval = monConfig.minimizedPollInterval;
      log.debug(`Using minimized poll interval: ${nextInterval}ms`);
    }
    
    statsInterval = setTimeout(pollStats, nextInterval);
  }
}

// App initialization with security setup
app.whenReady().then(async () => {
  try {
    log.info('App ready, setting up security...');
    setupSecurity();

    log.info('Creating main window...');
    createWindow();

    log.info('Starting system monitoring...');
    pollStats();
  } catch (error) {
    log.error('Failed to initialize app:', error);
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('App is quitting...');
  cleanup();
});

// Remove existing error handlers since ErrorHandler class handles them
// The ErrorHandler constructor already sets up these handlers
