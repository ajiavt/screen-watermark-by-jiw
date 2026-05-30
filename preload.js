const { contextBridge, ipcRenderer } = require('electron');
const { pathToFileURL } = require('url');

contextBridge.exposeInMainWorld('electronAPI', {
  getState: () => ipcRenderer.invoke('get-app-state'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  setImagePath: (imagePath) => ipcRenderer.invoke('set-image-path', imagePath),
  closeApp: () => ipcRenderer.send('close-app'),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  setLocked: (locked) => ipcRenderer.send('set-locked', locked),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  toFileUrl: (filePath) => {
    if (typeof filePath !== 'string' || filePath.length === 0) return '';
    return pathToFileURL(filePath).toString();
  },
  onLockedChanged: (callback) => {
    ipcRenderer.removeAllListeners('locked-changed');
    ipcRenderer.on('locked-changed', (_event, locked) => callback(Boolean(locked)));
  },
});

// Intentionally keep preload small: renderer listens to explicit events via exposed helpers.
