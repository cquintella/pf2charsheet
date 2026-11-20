const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  onCloseRequested: callback => {
    const listener = () => callback();
    ipcRenderer.on('request-close', listener);
    return () => ipcRenderer.removeListener('request-close', listener);
  },
  allowClose: () => ipcRenderer.send('allow-close')
});
