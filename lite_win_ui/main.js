// main.js
// By: NathanGr33n
// August 2025

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
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
  shellPty.onData(data => mainWindow?.webContents.send('term:data', data));
}

ipcMain.on('term:init', (_evt, size) => {
  if (!shellPty) startShell(size?.cols || 120, size?.rows || 32);
});
ipcMain.on('term:resize', (_evt, size) => {
  if (shellPty && size?.cols && size?.rows) shellPty.resize(size.cols, size.rows);
});
ipcMain.on('term:write', (_evt, data) => shellPty?.write(data));

async function pollStats() {
  try {
    const [cpu, mem, net, disk, bat, temp] = await Promise.all([
      si.currentLoad(), si.mem(), si.networkStats(), si.fsSize(),
      si.battery().catch(()=>({hasbattery:false})), si.cpuTemperature().catch(()=>({main:null}))
    ]);
    const payload = {
      time: Date.now(),
      platform: os.platform(), release: os.release(), hostname: os.hostname(),
      cpu: { avgLoad: cpu.currentLoad, cores: cpu.cpus?.map(c => c.load) || [] },
      mem: { total: mem.total, free: mem.free, used: mem.active },
      net: net.map(n => ({ iface: n.iface, rx: n.rx_bytes, tx: n.tx_bytes, rx_sec: n.rx_sec, tx_sec: n.tx_sec })),
      disks: disk.map(d => ({ fs: d.fs, used: d.used, size: d.size, mount: d.mount })),
      battery: bat, temperature: temp
    };
    mainWindow?.webContents.send('stats:update', payload);
  } catch {}
  setTimeout(pollStats, 1000);
}
app.whenReady().then(pollStats);
