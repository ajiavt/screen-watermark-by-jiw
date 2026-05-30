const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;

function createWindow() {
  const savedBounds = store.get('windowBounds') || { width: 260, height: 200, x: undefined, y: undefined };
  const savedOpacity = store.get('watermarkOpacity', 1);
  const savedLocked = store.get('watermarkLocked', false);

  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 140,
    minHeight: 90,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    skipTaskbar: true, // To make it feel more like an overlay
  });

  mainWindow.loadFile('index.html');

  mainWindow.setOpacity(savedOpacity);
  mainWindow.setIgnoreMouseEvents(Boolean(savedLocked), { forward: true });

  let boundsSaveTimer;
  const scheduleSaveBounds = () => {
    if (!mainWindow) return;
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => {
      if (!mainWindow) return;
      store.set('windowBounds', mainWindow.getBounds());
    }, 250);
  };

  // Electron versions differ on whether they emit move/moved and resize/resized.
  // Listen to both to ensure persistence works across versions.
  for (const eventName of ['move', 'moved', 'resize', 'resized']) {
    mainWindow.on(eventName, scheduleSaveBounds);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools - remove for production
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  createWindow();

  const toggleLocked = () => {
    const nextLocked = !store.get('watermarkLocked', false);
    store.set('watermarkLocked', nextLocked);
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(nextLocked, { forward: true });
      mainWindow.webContents.send('locked-changed', nextLocked);
    }
  };

  globalShortcut.register('CommandOrControl+Shift+L', toggleLocked);

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

ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    store.set('watermarkImagePath', result.filePaths[0]);
    return result.filePaths[0];
  }
  return store.get('watermarkImagePath'); // Return last saved if canceled or no selection
});

ipcMain.handle('get-last-image', () => {
  return store.get('watermarkImagePath');
});

ipcMain.handle('set-image-path', (_event, imagePath) => {
  if (typeof imagePath === 'string' && imagePath.length > 0) {
    store.set('watermarkImagePath', imagePath);
    return imagePath;
  }
  return store.get('watermarkImagePath');
});

ipcMain.on('close-app', () => {
  app.quit();
});

ipcMain.on('set-opacity', (event, opacity) => {
  if (mainWindow) {
    const nextOpacity = Number(opacity);
    if (!Number.isFinite(nextOpacity)) return;
    const clamped = Math.min(1, Math.max(0.05, nextOpacity));
    mainWindow.setOpacity(clamped);
    store.set('watermarkOpacity', clamped);
  }
});

ipcMain.handle('get-last-opacity', () => {
  return store.get('watermarkOpacity', 1); // Default to 1 (fully opaque)
});

ipcMain.handle('get-app-state', () => {
  return {
    imagePath: store.get('watermarkImagePath', null),
    opacity: store.get('watermarkOpacity', 1),
    locked: store.get('watermarkLocked', false),
    windowBounds: mainWindow ? mainWindow.getBounds() : store.get('windowBounds', null),
  };
});

ipcMain.handle('get-window-bounds', () => {
  return mainWindow ? mainWindow.getBounds() : store.get('windowBounds', null);
});

ipcMain.on('set-locked', (_event, locked) => {
  const nextLocked = Boolean(locked);
  store.set('watermarkLocked', nextLocked);
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(nextLocked, { forward: true });
    mainWindow.webContents.send('locked-changed', nextLocked);
  }
});

ipcMain.on('resize-window', (_event, width, height) => {
  if (!mainWindow) return;
  const nextWidth = Math.round(Number(width));
  const nextHeight = Math.round(Number(height));
  if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) return;
  mainWindow.setSize(
    Math.max(nextWidth, 140),
    Math.max(nextHeight, 90),
    true
  );
});

// Allow the window to be shown/hidden if needed later
// ipcMain.on('show-window', () => mainWindow && mainWindow.show());
// ipcMain.on('hide-window', () => mainWindow && mainWindow.hide());

// Ensure the app quits when explicitly told to, even on macOS
app.on('before-quit', () => {
  // You might want to save any final state here
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
