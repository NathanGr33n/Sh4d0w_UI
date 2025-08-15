const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('edex', {
  sendTermInit: (size) => ipcRenderer.send('term:init', size),
  sendTermData: (data) => ipcRenderer.send('term:write', data),
  sendResize: (size) => ipcRenderer.send('term:resize', size),
  onTermData: (cb) => ipcRenderer.on('term:data', (_e, data) => cb(data)),
  onStats: (cb) => ipcRenderer.on('stats:update', (_e, data) => cb(data)),
});
