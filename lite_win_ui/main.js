// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

// Prefer prebuilt pty on Windows
let pty;
try { pty = require('node-pty-prebuilt-multiarch'); }
catch { pty = require('node-pty'); }

const si = require('systeminformation');

let mainWindow;
let shellPty;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

function startShell(cols = 120, rows = 32) {
  const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
  shellPty = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols, rows,
    cwd: process.cwd(),
    env: process.env
  });
  shellPty.onData(data => {
    mainWindow?.webContents.send('term:data', data);
  });
}

ipcMain.on('term:init', (evt, size) => {
  if (!shellPty) startShell(size?.cols || 120, size?.rows || 32);
});

ipcMain.on('term:resize', (evt, size) => {
  if (shellPty && size?.cols && size?.rows) {
    shellPty.resize(size.cols, size.rows);
  }
});

ipcMain.on('term:write', (evt, data) => {
  shellPty?.write(data);
});

async function pollStats() {
  try {
    const [cpu, mem, osInfo, net, disk, bat, temp] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.osInfo(),
      si.networkStats(),
      si.fsSize(),
      si.battery().catch(() => ({ hasbattery:false })),
      si.cpuTemperature().catch(() => ({ main: null }))
    ]);
    const payload = {
      time: Date.now(),
      platform: os.platform(),
      release: os.release(),
      hostname: os.hostname(),
      cpu: { avgLoad: cpu.currentLoad, cores: cpu.cpus?.map(c => c.load) || [] },
      mem: { total: mem.total, free: mem.free, used: mem.active },
      net: net.map(n => ({ iface: n.iface, rx: n.rx_bytes, tx: n.tx_bytes, rx_sec: n.rx_sec, tx_sec: n.tx_sec })),
      disks: disk.map(d => ({ fs: d.fs, used: d.used, size: d.size, mount: d.mount })),
      battery: bat,
      temperature: temp
    };
    mainWindow?.webContents.send('stats:update', payload);
  } catch {}
  setTimeout(pollStats, 1000);
}
app.whenReady().then(pollStats);
