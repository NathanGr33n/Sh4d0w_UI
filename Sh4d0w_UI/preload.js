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
  sendDebugCommand: (command) => safeIpcSend('debug:command', command)
});
