const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Configure autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Disable background throttling for idle games to keep progressing at full speed
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 380,
    minHeight: 380,
    backgroundColor: '#0c0f17',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    title: '4Navigator - Idle Game Browser',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let savedWindowBounds = null;
let isMiniWidget = false;

// IPC Handlers
ipcMain.handle('window:toggle-mini-widget', () => {
  if (!mainWindow) return false;
  if (!isMiniWidget) {
    savedWindowBounds = {
      bounds: mainWindow.getBounds(),
      maximized: mainWindow.isMaximized()
    };
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    }
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setSize(480, 480);
    isMiniWidget = true;
    return true;
  } else {
    mainWindow.setAlwaysOnTop(false);
    if (savedWindowBounds) {
      mainWindow.setBounds(savedWindowBounds.bounds);
      if (savedWindowBounds.maximized) {
        mainWindow.maximize();
      }
    } else {
      mainWindow.setSize(1440, 900);
    }
    isMiniWidget = false;
    return false;
  }
});

ipcMain.handle('window:is-mini-widget', () => isMiniWidget);

ipcMain.handle('window:set-fps-limit', (event, fps) => {
  if (!mainWindow) return;
  const targetFps = Math.max(10, Math.min(120, Number(fps) || 60));
  mainWindow.webContents.setFrameRate(targetFps);
  return targetFps;
});

ipcMain.handle('window:toggle-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('app:get-metrics', () => {
  const metrics = app.getAppMetrics();
  let totalWorkingSet = 0;
  const processList = metrics.map(m => {
    const memoryMB = Math.round((m.memory.workingSetSize || 0) / 1024);
    totalWorkingSet += memoryMB;
    return {
      pid: m.pid,
      type: m.type,
      memoryMB,
      cpuPercent: +(m.cpu.percentCPUUsage || 0).toFixed(1)
    };
  });
  return {
    totalMB: totalWorkingSet,
    processes: processList
  };
});

ipcMain.handle('app:clear-cache', async () => {
  const { session } = require('electron');
  if (session && session.defaultSession) {
    await session.defaultSession.clearCache();
  }
  return true;
});

ipcMain.handle('app:open-external', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
  }
});

// Auto-Updater Handlers & Events
ipcMain.handle('updater:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo || null };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('updater:download', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('updater:get-current-version', () => {
  return app.getVersion();
});

function sendUpdaterStatus(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

autoUpdater.on('checking-for-update', () => {
  sendUpdaterStatus('updater:status', { state: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  sendUpdaterStatus('updater:status', {
    state: 'available',
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes || 'Nova versão com melhorias e correções.'
  });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdaterStatus('updater:status', {
    state: 'not-available',
    version: info.version
  });
});

autoUpdater.on('error', (err) => {
  sendUpdaterStatus('updater:status', {
    state: 'error',
    message: err == null ? 'Erro desconhecido ao verificar atualizações' : (err.stack || err).toString()
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  sendUpdaterStatus('updater:status', {
    state: 'downloading',
    percent: Math.round(progressObj.percent),
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total
  });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdaterStatus('updater:status', {
    state: 'downloaded',
    version: info.version
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
