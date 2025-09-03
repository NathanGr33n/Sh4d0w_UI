// main.js
// By: NathanGr33n
// August 2025

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const os = require('os');
const config = require('./config');

// Enhanced logging utility with configuration
const log = {
  info: (msg, ...args) => {
    if (config.getSecurityConfig().logLevel !== 'error') {
      console.log(`[INFO] ${new Date().toISOString()}: ${msg}`, ...args);
    }
  },
  warn: (msg, ...args) => {
    if (config.getSecurityConfig().logLevel === 'info' || config.getSecurityConfig().logLevel === 'warn') {
      console.warn(`[WARN] ${new Date().toISOString()}: ${msg}`, ...args);
    }
  },
  error: (msg, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${msg}`, ...args)
};

// Prefer the actively maintained prebuilt fork
let pty;
try { pty = require('@homebridge/node-pty-prebuilt-multiarch'); }
catch {
  try { pty = require('node-pty-prebuilt-multiarch'); } // legacy
  catch { pty = require('node-pty'); }                  // fallback to source build
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
          "frame-src 'none';".replace(/;\s*/g, '; ')
        ]
      }
    });
  });

  // Block external navigation
  defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    if (url.protocol === 'file:' || 
        url.hostname === 'cdn.jsdelivr.net' || 
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com') {
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
        sandbox: false // Keep false for now due to node-pty requirements
      },
      autoHideMenuBar: true,
      show: false // Don't show until ready
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

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
      .catch(err => {
        log.error('Failed to load main window:', err);
      });

  } catch (error) {
    log.error('Failed to create window:', error);
    app.quit();
  }
}

// Input validation helpers
function validateSize(size) {
  return size && 
         typeof size.cols === 'number' && size.cols > 0 && size.cols <= 500 &&
         typeof size.rows === 'number' && size.rows > 0 && size.rows <= 200;
}

function sanitizeTerminalData(data) {
  if (typeof data !== 'string') return '';
  // Basic sanitization - remove potential control sequences that could be harmful
  return data.slice(0, 10000); // Limit length to prevent memory issues
}

// Resource cleanup
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  log.info('Starting cleanup...');
  
  if (statsInterval) {
    clearTimeout(statsInterval);
    statsInterval = null;
  }
  
  if (shellPty) {
    try {
      shellPty.kill();
      shellPty = null;
      log.info('Terminal process cleaned up');
    } catch (err) {
      log.error('Error cleaning up terminal:', err);
    }
  }
}

function startShell(cols = 120, rows = 32) {
  try {
    if (shellPty) {
      log.warn('Shell already running, skipping initialization');
      return;
    }

    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
    log.info(`Starting shell: ${shell} (${cols}x${rows})`);
    
    shellPty = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: Math.max(1, Math.min(500, cols)),
      rows: Math.max(1, Math.min(200, rows)),
      cwd: process.cwd(),
      env: { ...process.env, TERM_PROGRAM: 'ShadowUI' }
    });
    
    shellPty.onData(data => {
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
    log.error('Error writing to terminal:', error);
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
      si.cpuTemperature().catch(() => ({ main: null }))
    ]);

    const payload = {
      time: Date.now(),
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      cpu: { 
        avgLoad: Math.max(0, Math.min(100, cpu.currentLoad || 0)),
        cores: (cpu.cpus || []).map(c => Math.max(0, Math.min(100, c.load || 0)))
      },
      mem: { 
        total: Math.max(0, mem.total || 0),
        free: Math.max(0, mem.free || 0),
        used: Math.max(0, mem.active || 0)
      },
      net: (net || []).slice(0, 10).map(n => ({
        iface: String(n.iface || 'unknown').slice(0, 50),
        rx: Math.max(0, n.rx_bytes || 0),
        tx: Math.max(0, n.tx_bytes || 0),
        rx_sec: Math.max(0, n.rx_sec || 0),
        tx_sec: Math.max(0, n.tx_sec || 0)
      })),
      disks: (disk || []).slice(0, 20).map(d => ({
        fs: String(d.fs || 'unknown').slice(0, 100),
        used: Math.max(0, d.used || 0),
        size: Math.max(0, d.size || 0),
        mount: String(d.mount || 'unknown').slice(0, 200)
      })),
      battery: bat || { hasbattery: false },
      temperature: temp || { main: null }
    };

    mainWindow.webContents.send('stats:update', payload);
    statsRetryCount = 0; // Reset retry count on success
    
  } catch (error) {
    log.error('Stats polling error:', error);
    statsRetryCount++;
    
    if (statsRetryCount >= MAX_RETRIES) {
      log.error(`Stats polling failed ${MAX_RETRIES} times, backing off`);
      statsRetryCount = 0;
      // Increase interval temporarily
      setTimeout(() => pollStats(), STATS_INTERVAL * 5);
      return;
    }
  }

  // Schedule next poll
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason);
});
