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

// Initialize advanced logging system
const securityConfig = config.getSecurityConfig();
const logger = new Logger({
  logLevel: securityConfig.logLevel,
  enableConsole: true,
  enableFile: securityConfig.enableLogging,
});

// Initialize error handler
const errorHandler = new ErrorHandler(logger);

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

let mainWindow;
let shellPty;
let statsInterval;
let isShuttingDown = false;

// Rate limiting for system monitoring - now configurable
const monitoringConfig = config.getMonitoringConfig();
const STATS_INTERVAL = monitoringConfig.pollInterval;
const MAX_RETRIES = monitoringConfig.maxRetries;
let statsRetryCount = 0;

// Security: Set up Content Security Policy
function setupSecurity() {
  const defaultSession = session.defaultSession;

  // CSP Header
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline';",
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
      log.info('Window ready and shown');
    });

    // Handle window closed
    mainWindow.on('closed', () => {
      mainWindow = null;
      cleanup();
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
  // Basic sanitization - remove potential control sequences that could be harmful
  return data.slice(0, 10000); // Limit length to prevent memory issues
}

// Resource cleanup with enhanced error handling
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

  // Clear stats interval
  if (statsInterval) {
    clearTimeout(statsInterval);
    statsInterval = null;
  }

  // Kill shell process
  if (shellPty) {
    try {
      shellPty.kill();
      shellPty = null;
      log.info('Terminal process cleaned up');
    } catch (err) {
      errorHandler.handleError(err, 'cleanup-shell');
    }
  }

  log.timeEnd('cleanup');
  log.info('Cleanup completed');

  // Close logger LAST to ensure all logs are written
  if (logger) {
    logger.close();
  }
}

function startShell(cols = 120, rows = 32) {
  try {
    if (shellPty) {
      log.warn('Shell already running, skipping initialization');
      return;
    }

    const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';
    log.info(`Starting shell: ${shell} (${cols}x${rows})`);

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
      PWD: process.cwd(),
    };

    shellPty = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: Math.max(1, Math.min(500, cols)),
      rows: Math.max(1, Math.min(200, rows)),
      cwd: process.cwd(),
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

// Enhanced IPC handlers with validation
ipcMain.on('term:init', (_evt, size) => {
  try {
    if (!shellPty) {
      const validSize = validateSize(size);
      if (validSize) {
        startShell(size.cols, size.rows);
      } else {
        log.warn('Invalid terminal size provided, using defaults');
        startShell();
      }
    }
  } catch (error) {
    log.error('Error in term:init handler:', error);
  }
});

ipcMain.on('term:resize', (_evt, size) => {
  try {
    if (shellPty && validateSize(size)) {
      shellPty.resize(size.cols, size.rows);
      log.info(`Terminal resized to ${size.cols}x${size.rows}`);
    } else {
      log.warn('Invalid resize parameters or no terminal');
    }
  } catch (error) {
    log.error('Error resizing terminal:', error);
  }
});

ipcMain.on('term:write', (_evt, data) => {
  try {
    if (shellPty) {
      const sanitizedData = sanitizeTerminalData(data);
      shellPty.write(sanitizedData);
    }
  } catch (error) {
    errorHandler.handleError(error, 'term:write');
  }
});

// Renderer error reporting
ipcMain.on('renderer:error', (_evt, errorData) => {
  errorHandler.handleError(new Error(errorData.message), 'renderer', {
    ...errorData,
    source: 'renderer-process',
  });
});

// Debug info handler
ipcMain.handle('debug:get-info', async () => {
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

// Debug command handler
ipcMain.on('debug:command', (_evt, command) => {
  try {
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

// Enhanced stats polling with error handling and rate limiting
async function pollStats() {
  if (isShuttingDown || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  try {
    const [cpu, mem, net, disk, bat, temp] = await Promise.all([
      si.currentLoad().catch(() => ({ currentLoad: 0, cpus: [] })),
      si.mem().catch(() => ({ total: 0, free: 0, active: 0 })),
      si.networkStats().catch(() => []),
      si.fsSize().catch(() => []),
      si.battery().catch(() => ({ hasbattery: false })),
      si.cpuTemperature().catch(() => ({ main: null })),
    ]);

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

  // Schedule next poll (only reached if no backoff)
  if (!isShuttingDown) {
    statsInterval = setTimeout(pollStats, STATS_INTERVAL);
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
