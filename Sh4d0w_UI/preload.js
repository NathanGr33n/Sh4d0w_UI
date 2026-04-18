//preload.js
//By: NathanGr33n
//August 2025

const { contextBridge, ipcRenderer } = require('electron');

// Enhanced IPC with error handling
const safeIpcSend = (channel, data) => {
  try {
    ipcRenderer.send(channel, data);
  } catch (error) {
    console.error(`[Preload] IPC Send Error on ${channel}:`, error);
  }
};

const safeIpcOn = (channel, callback) => {
  try {
    ipcRenderer.on(channel, (_e, data) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[Preload] IPC Callback Error on ${channel}:`, error);
      }
    });
  } catch (error) {
    console.error(`[Preload] IPC On Error for ${channel}:`, error);
  }
};

contextBridge.exposeInMainWorld('edex', {
  sendTermInit: (size) => safeIpcSend('term:init', size),
  sendTermData: (data) => safeIpcSend('term:write', data),
  sendResize: (size) => safeIpcSend('term:resize', size),
  onTermData: (cb) => safeIpcOn('term:data', cb),
  onStats: (cb) => safeIpcOn('stats:update', cb),
  sendError: (errorData) => safeIpcSend('renderer:error', errorData),
  getDebugInfo: () => ipcRenderer.invoke('debug:get-info'),
  sendDebugCommand: (command) => safeIpcSend('debug:command', command),
  // Configuration management
  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
  // Zoom controls
  setZoom: (level) => ipcRenderer.invoke('zoom:set', level),
  getZoom: () => ipcRenderer.invoke('zoom:get'),
  resetZoom: () => ipcRenderer.invoke('zoom:reset'),
  // Command history
  addCommand: (command) => ipcRenderer.invoke('history:add', command),
  getHistory: (limit) => ipcRenderer.invoke('history:get', limit),
  searchHistory: (query) => ipcRenderer.invoke('history:search', query),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  getHistoryStats: () => ipcRenderer.invoke('history:stats'),
  // Theme management
  setTheme: (themeName) => ipcRenderer.invoke('theme:set', themeName),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  // Git integration
  getGitStatus: (cwd) => ipcRenderer.invoke('git:status', cwd),
  getGitCommits: (cwd, count) => ipcRenderer.invoke('git:commits', cwd, count),
  getGitRemote: (cwd) => ipcRenderer.invoke('git:remote', cwd),
});

// ---------------------------------------------------------------------------
// Shell-mode API
// Exposed separately from `edex` so the surface is obvious to auditors and so
// callers can feature-detect via `!!window.shadow?.shell`.
// All methods return promises; nothing accepts arbitrary strings that get
// concatenated in main -- all validation happens in main.js.
// ---------------------------------------------------------------------------
contextBridge.exposeInMainWorld('shadow', {
  shell: {
    isShellMode: () => ipcRenderer.invoke('shell:isShellMode:check'),
    launchApp: (opts) => ipcRenderer.invoke('shell:launchApp', opts),
    listStartMenu: () => ipcRenderer.invoke('shell:listStartMenu'),
    listWindows: () => ipcRenderer.invoke('shell:listWindows'),
    focusWindow: (pid) => ipcRenderer.invoke('shell:focusWindow', pid),
    launchExplorer: () => ipcRenderer.invoke('shell:launchExplorer'),
    power: {
      logoff: () => ipcRenderer.invoke('shell:power', 'logoff'),
      restart: () => ipcRenderer.invoke('shell:power', 'restart'),
      shutdown: () => ipcRenderer.invoke('shell:power', 'shutdown'),
      lock: () => ipcRenderer.invoke('shell:power', 'lock'),
    },
  },
});
