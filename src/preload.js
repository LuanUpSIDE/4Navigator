const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('navigatorAPI', {
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMiniWidget: () => ipcRenderer.invoke('window:toggle-mini-widget'),
  isMiniWidget: () => ipcRenderer.invoke('window:is-mini-widget'),
  setFpsLimit: (fps) => ipcRenderer.invoke('window:set-fps-limit', fps),
  getMetrics: () => ipcRenderer.invoke('app:get-metrics'),
  clearCache: () => ipcRenderer.invoke('app:clear-cache'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  platform: process.platform
});
