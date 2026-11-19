const { app, BrowserWindow, shell, ipcMain, screen } = require('electron');
const path = require('path');

// 1. Display Server: Wayland First with automatic X11 Fallback
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations,UseOzonePlatform,VaapiVideoDecoder,CanvasOopRasterization');

// 2. High Performance & 120Hz+ High Refresh Rate with VSync Synchronization (Mesa RadeonSI)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-frame-rate-limit');

// Set AppUserModelId matching Windows AppX/NSIS appId on win32 and .desktop id on Linux
app.setAppUserModelId(process.platform === 'win32' ? 'NSK-Natsuki.SeedPlanet' : 'com.seedplanet.game');

let mainWindow = null;

function createWindow() {
  const iconPath = path.join(__dirname, 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'SeedPlanet',
    icon: iconPath,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webSecurity: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  if (app.isPackaged) {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  } else {
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    mainWindow.loadURL(devUrl).catch(() => {
      const indexPath = path.join(__dirname, '../dist/index.html');
      mainWindow.loadFile(indexPath);
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ipcMain.handle('get-display-hz', () => {
    try {
      const primary = screen.getPrimaryDisplay();
      return (primary && primary.displayFrequency) ? primary.displayFrequency : 0;
    } catch (e) {
      return 0;
    }
  });

  ipcMain.handle('set-fullscreen', (_event, flag) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(!!flag);
        return mainWindow.isFullScreen();
      }
    } catch (e) {}
    return false;
  });

  ipcMain.handle('is-fullscreen', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow.isFullScreen();
      }
    } catch (e) {}
    return false;
  });

  ipcMain.handle('quit-app', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
      app.quit();
      return true;
    } catch (e) {
      return false;
    }
  });

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
