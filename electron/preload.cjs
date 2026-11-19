const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  getDisplayHz: () => ipcRenderer.invoke('get-display-hz'),
  setFullscreen: (flag) => ipcRenderer.invoke('set-fullscreen', flag),
  isFullscreen: () => ipcRenderer.invoke('is-fullscreen'),
  quitApp: () => ipcRenderer.invoke('quit-app')
});
