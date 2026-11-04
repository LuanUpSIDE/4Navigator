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
  platform: process.platform,
  getGpuStatus: () => ipcRenderer.invoke('gpu:get-status'),
  setGpuStatus: (enabled) => ipcRenderer.invoke('gpu:set-status', enabled),
  relaunch: () => ipcRenderer.invoke('app:relaunch'),
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getCurrentVersion: () => ipcRenderer.invoke('updater:get-current-version'),
    getAppInfo: () => ipcRenderer.invoke('updater:get-app-info'),
    openDownloadUrl: (url) => ipcRenderer.invoke('updater:open-download-url', url),
    onStatus: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('updater:status', subscription);
      return () => ipcRenderer.removeListener('updater:status', subscription);
    }
  },
  credentials: {
    getAll: () => ipcRenderer.invoke('credentials:get-all'),
    getForUrl: (url) => ipcRenderer.invoke('credentials:get-for-url', url),
    save: (entry) => ipcRenderer.invoke('credentials:save', entry),
    delete: (id) => ipcRenderer.invoke('credentials:delete', id)
  },
  notes: {
    getAll: () => ipcRenderer.invoke('notes:get-all'),
    saveAll: (notesObj) => ipcRenderer.invoke('notes:save-all', notesObj),
    showContextMenu: () => ipcRenderer.invoke('notes:show-context-menu'),
    onTriggerCopyAll: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('notes:trigger-copy-all', handler);
      return () => ipcRenderer.removeListener('notes:trigger-copy-all', handler);
    },
    onTriggerClear: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('notes:trigger-clear', handler);
      return () => ipcRenderer.removeListener('notes:trigger-clear', handler);
    }
  },
  security: {
    onDownloadBlocked: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('security:download-blocked', handler);
      return () => ipcRenderer.removeListener('security:download-blocked', handler);
    },
    onMinerBlocked: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('security:miner-blocked', handler);
      return () => ipcRenderer.removeListener('security:miner-blocked', handler);
    },
    getMinerLogs: () => ipcRenderer.invoke('security:get-miner-logs'),
    clearMinerLogs: () => ipcRenderer.invoke('security:clear-miner-logs'),
    simulateMinerDetection: (data) => ipcRenderer.invoke('security:simulate-miner-detection', data || {})
  },
  vaultSecurity: {
    hasMasterPin: () => ipcRenderer.invoke('vault:has-master-pin'),
    setMasterPin: (data) => ipcRenderer.invoke('vault:set-master-pin', data),
    verifyMasterPin: (pin) => ipcRenderer.invoke('vault:verify-master-pin', pin),
    removeMasterPin: (currentPin) => ipcRenderer.invoke('vault:remove-master-pin', currentPin)
  },
  online: {
    getSettings: () => ipcRenderer.invoke('online:get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('online:save-settings', settings),
    getUserAgent: () => ipcRenderer.invoke('online:get-user-agent')
  }
});
