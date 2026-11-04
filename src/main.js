const { app, BrowserWindow, ipcMain, shell, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Storage Directory resolver: Portable vs Installed
function getStorageDirectory() {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    const portableDataDir = path.join(portableDir, '4Navigator-Data');
    try {
      if (!fs.existsSync(portableDataDir)) {
        fs.mkdirSync(portableDataDir, { recursive: true });
      }
      return portableDataDir;
    } catch (_) {}
  }
  return app.getPath('userData');
}

// Configuration file for persistent app settings (e.g., GPU hardware acceleration)
const configFilePath = path.join(getStorageDirectory(), 'app-settings.json');
const notesFilePath = path.join(getStorageDirectory(), 'notes-data.json');

function loadAppSettings() {
  try {
    if (fs.existsSync(configFilePath)) {
      const content = fs.readFileSync(configFilePath, 'utf8');
      return JSON.parse(content || '{}');
    }
    const fallbackPath = path.join(app.getPath('userData'), 'app-settings.json');
    if (configFilePath !== fallbackPath && fs.existsSync(fallbackPath)) {
      const content = fs.readFileSync(fallbackPath, 'utf8');
      return JSON.parse(content || '{}');
    }
  } catch (_) {}
  return { gpuAcceleration: true }; // Enabled by default
}

function saveAppSettings(settings) {
  try {
    const current = loadAppSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(configFilePath, JSON.stringify(updated, null, 2), 'utf8');
    const fallbackPath = path.join(app.getPath('userData'), 'app-settings.json');
    if (configFilePath !== fallbackPath) {
      try {
        fs.writeFileSync(fallbackPath, JSON.stringify(updated, null, 2), 'utf8');
      } catch (_) {}
    }
    return true;
  } catch (_) {
    return false;
  }
}

const currentConfig = loadAppSettings();
// GPU Hardware acceleration: enabled by default. If explicitly false, disable it before app is ready.
if (currentConfig.gpuAcceleration === false) {
  app.disableHardwareAcceleration();
}

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
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

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

// GPU Hardware Acceleration Handlers
ipcMain.handle('gpu:get-status', () => {
  const settings = loadAppSettings();
  return {
    gpuAcceleration: settings.gpuAcceleration !== false // true by default
  };
});

ipcMain.handle('gpu:set-status', (event, enabled) => {
  const isEnabled = Boolean(enabled);
  saveAppSettings({ gpuAcceleration: isEnabled });
  return { success: true, gpuAcceleration: isEnabled };
});

ipcMain.handle('app:relaunch', () => {
  app.relaunch();
  app.exit(0);
});

// ================= Credentials Vault (Logins & Passwords) =================
const credentialsFilePath = path.join(getStorageDirectory(), 'credentials-vault.json');

const crypto = require('crypto');
const VAULT_SALT = '4Navigator-idle-vault-salt';

function getCryptoKey() {
  return crypto.scryptSync('4Nav-Secret-Key-2026', VAULT_SALT, 32);
}

function encryptPassword(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getCryptoKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    content: encrypted.toString('hex'),
    tag: tag.toString('hex')
  });
}

function decryptPassword(dataStr) {
  if (!dataStr) return '';
  try {
    const parsed = JSON.parse(dataStr);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getCryptoKey(),
      Buffer.from(parsed.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.content, 'hex')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (_) {
    return '';
  }
}

function loadCredentialsVault() {
  try {
    if (fs.existsSync(credentialsFilePath)) {
      const raw = fs.readFileSync(credentialsFilePath, 'utf8');
      return JSON.parse(raw || '[]');
    }
  } catch (_) {}
  return [];
}

function saveCredentialsVault(vault) {
  try {
    fs.writeFileSync(credentialsFilePath, JSON.stringify(vault, null, 2), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

ipcMain.handle('credentials:get-all', () => {
  const vault = loadCredentialsVault();
  return vault.map(c => ({
    id: c.id,
    title: c.title,
    domain: c.domain,
    username: c.username,
    password: decryptPassword(c.password),
    updatedAt: c.updatedAt
  }));
});

ipcMain.handle('credentials:get-for-url', (event, url) => {
  if (!url) return [];
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const vault = loadCredentialsVault();
    const matches = vault.filter(c => {
      const savedDomain = (c.domain || '').replace(/^www\./, '').toLowerCase();
      return domain.includes(savedDomain) || savedDomain.includes(domain);
    });
    return matches.map(c => ({
      id: c.id,
      title: c.title,
      domain: c.domain,
      username: c.username,
      password: decryptPassword(c.password),
      updatedAt: c.updatedAt
    }));
  } catch (_) {
    return [];
  }
});

ipcMain.handle('credentials:save', (event, entry) => {
  if (!entry || !entry.username) return { success: false, error: 'Usuário é obrigatório' };
  const vault = loadCredentialsVault();
  const id = entry.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const encryptedPass = encryptPassword(entry.password || '');

  const index = vault.findIndex(item => item.id === id);
  const record = {
    id,
    title: entry.title || entry.domain || 'Login do Jogo',
    domain: (entry.domain || '').toLowerCase().replace(/^www\./, ''),
    username: entry.username.trim(),
    password: encryptedPass,
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) {
    vault[index] = record;
  } else {
    vault.push(record);
  }

  saveCredentialsVault(vault);
  return { success: true, id };
});

ipcMain.handle('credentials:delete', (event, id) => {
  if (!id) return false;
  const vault = loadCredentialsVault();
  const filtered = vault.filter(item => item.id !== id);
  saveCredentialsVault(filtered);
  return true;
});

// ================= Persistent Notes System (Portable & Installed) =================
function loadAllNotes() {
  const primaryPath = notesFilePath;
  const fallbackPath = path.join(app.getPath('userData'), 'notes-data.json');

  try {
    if (fs.existsSync(primaryPath)) {
      const raw = fs.readFileSync(primaryPath, 'utf8');
      return JSON.parse(raw || '{}');
    }
    if (primaryPath !== fallbackPath && fs.existsSync(fallbackPath)) {
      const raw = fs.readFileSync(fallbackPath, 'utf8');
      return JSON.parse(raw || '{}');
    }
  } catch (err) {
    console.error('Failed to load notes from disk:', err);
  }

  return {
    general: '',
    p1: '',
    p2: '',
    p3: '',
    p4: '',
    lastTab: 'general'
  };
}

function saveAllNotes(notesObj) {
  try {
    const primaryPath = notesFilePath;
    const dir = path.dirname(primaryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(primaryPath, JSON.stringify(notesObj, null, 2), 'utf8');

    // Also mirror to userData if running portable for maximum safety
    const fallbackPath = path.join(app.getPath('userData'), 'notes-data.json');
    if (primaryPath !== fallbackPath) {
      try {
        fs.writeFileSync(fallbackPath, JSON.stringify(notesObj, null, 2), 'utf8');
      } catch (_) {}
    }
    return true;
  } catch (err) {
    console.error('Failed to save notes to disk:', err);
    return false;
  }
}

ipcMain.handle('notes:get-all', () => {
  return loadAllNotes();
});

ipcMain.handle('notes:save-all', (event, notesObj) => {
  if (!notesObj || typeof notesObj !== 'object') return false;
  return saveAllNotes(notesObj);
});

// Notes Textarea Native Context Menu
ipcMain.handle('notes:show-context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const menu = Menu.buildFromTemplate([
    { role: 'undo', label: 'Desfazer' },
    { role: 'redo', label: 'Refazer' },
    { type: 'separator' },
    { role: 'cut', label: 'Recortar' },
    { role: 'copy', label: 'Copiar' },
    { role: 'paste', label: 'Colar' },
    { type: 'separator' },
    { role: 'selectAll', label: 'Selecionar Tudo' },
    { type: 'separator' },
    {
      label: 'Copiar Todas as Anotações Desta Aba',
      click: () => {
        event.sender.send('notes:trigger-copy-all');
      }
    },
    {
      label: 'Limpar Anotações Desta Aba',
      click: () => {
        event.sender.send('notes:trigger-clear');
      }
    }
  ]);

  menu.popup({ window: win });
});

// Auto-Updater Handlers & Events
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE);

ipcMain.handle('updater:get-app-info', () => {
  return {
    version: app.getVersion(),
    isPortable,
    platform: process.platform
  };
});

ipcMain.handle('updater:open-download-url', async (event, url) => {
  const targetUrl = url || 'https://github.com/LuanUpSIDE/4Navigator/releases/latest';
  await shell.openExternal(targetUrl);
  return true;
});

ipcMain.handle('updater:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo || null, isPortable };
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
    releaseNotes: info.releaseNotes || 'Nova versão com melhorias e correções.',
    isPortable
  });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdaterStatus('updater:status', {
    state: 'not-available',
    version: info.version
  });
});

autoUpdater.on('error', (err) => {
  let friendlyMessage = 'Não foi possível verificar atualizações no momento.';
  const raw = (err?.message || err?.stack || String(err || '')).toLowerCase();

  if (raw.includes('404')) {
    friendlyMessage = 'Nenhuma versão ou metadados de atualização encontrados no servidor do GitHub.';
  } else if (raw.includes('net::') || raw.includes('enotfound') || raw.includes('econnrefused')) {
    friendlyMessage = 'Sem conexão com a internet ou GitHub temporariamente inacessível.';
  } else if (err?.message) {
    friendlyMessage = err.message;
  }

  sendUpdaterStatus('updater:status', {
    state: 'error',
    message: friendlyMessage
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

// Native Context Menu (Right-Click) for Webviews & Main Window
app.on('web-contents-created', (event, contents) => {
  contents.on('context-menu', (e, params) => {
    const isWebview = contents.getType() === 'webview';
    const menuTemplate = [];

    // 1. Navigation items (for games / webviews)
    if (isWebview) {
      if (contents.canGoBack()) {
        menuTemplate.push({
          label: 'Voltar',
          accelerator: 'Alt+Left',
          click: () => contents.goBack()
        });
      }
      if (contents.canGoForward()) {
        menuTemplate.push({
          label: 'Avançar',
          accelerator: 'Alt+Right',
          click: () => contents.goForward()
        });
      }
      menuTemplate.push({
        label: 'Recarregar Jogo',
        accelerator: 'CmdOrCtrl+R',
        click: () => contents.reload()
      });
      menuTemplate.push({ type: 'separator' });
    }

    // 2. Media / Image Actions
    if (params.mediaType === 'image') {
      menuTemplate.push({
        label: 'Copiar Imagem',
        click: () => contents.copyImageAt(params.x, params.y)
      });
      if (params.srcURL) {
        menuTemplate.push({
          label: 'Copiar Endereço da Imagem',
          click: () => clipboard.writeText(params.srcURL)
        });
        menuTemplate.push({
          label: 'Abrir Imagem no Navegador',
          click: () => shell.openExternal(params.srcURL)
        });
        menuTemplate.push({
          label: 'Salvar Imagem Como...',
          click: () => contents.downloadURL(params.srcURL)
        });
      }
      menuTemplate.push({ type: 'separator' });
    }

    // 3. Link Actions
    if (params.linkURL) {
      menuTemplate.push({
        label: 'Abrir Link no Navegador Padrão',
        click: () => shell.openExternal(params.linkURL)
      });
      menuTemplate.push({
        label: 'Copiar Endereço do Link',
        click: () => clipboard.writeText(params.linkURL)
      });
      menuTemplate.push({ type: 'separator' });
    }

    // 4. Text Selection / Editing Actions
    if (params.isEditable) {
      menuTemplate.push({ role: 'undo', label: 'Desfazer' });
      menuTemplate.push({ role: 'redo', label: 'Refazer' });
      menuTemplate.push({ type: 'separator' });
      menuTemplate.push({ role: 'cut', label: 'Recortar' });
      menuTemplate.push({ role: 'copy', label: 'Copiar' });
      menuTemplate.push({ role: 'paste', label: 'Colar' });
      menuTemplate.push({ role: 'selectAll', label: 'Selecionar Tudo' });
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      menuTemplate.push({ role: 'copy', label: 'Copiar' });
      const query = params.selectionText.trim();
      menuTemplate.push({
        label: `Pesquisar "${query.length > 25 ? query.substring(0, 22) + '...' : query}" no Google`,
        click: () => shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(query)}`)
      });
      menuTemplate.push({ role: 'selectAll', label: 'Selecionar Tudo' });
    }

    // 5. Developer Tools (Inspect Element)
    if (menuTemplate.length > 0 && menuTemplate[menuTemplate.length - 1].type !== 'separator') {
      menuTemplate.push({ type: 'separator' });
    }
    menuTemplate.push({
      label: 'Inspecionar Elemento',
      click: () => contents.inspectElement(params.x, params.y)
    });

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup();
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
