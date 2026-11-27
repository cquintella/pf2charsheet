const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalServer, resolveSqlJsWasmPath } = require('./apiServer.cjs');
const { upgradeCatalog } = require('./catalog-upgrade.cjs');

let mainWindow = null;
let localServer = null;

// The catalog (pf2e.db) is replaced whenever the app version changes; user-created content and
// legacy characters are carried over (see catalog-upgrade.cjs). A backup stays at pf2e.db.bak.
async function ensureDatabasePath() {
  if (!app.isPackaged) {
    return path.resolve(__dirname, '../pf2e.db');
  }
  const userDbPath = path.join(app.getPath('userData'), 'pf2e.db');
  const markerPath = path.join(app.getPath('userData'), 'catalog-version.txt');
  const bundledDbPath = path.join(process.resourcesPath, 'pf2e.db');
  if (!fs.existsSync(userDbPath)) {
    fs.mkdirSync(path.dirname(userDbPath), { recursive: true });
    fs.copyFileSync(bundledDbPath, userDbPath);
  } else {
    const installed = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() : '';
    if (installed === app.getVersion()) return userDbPath;
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({ locateFile: () => resolveSqlJsWasmPath() });
    upgradeCatalog(SQL, userDbPath, bundledDbPath);
  }
  fs.writeFileSync(markerPath, app.getVersion());
  return userDbPath;
}

async function createWindow() {
  const isViteDev = process.env.WAIT_ON_WEB === 'true';
  let targetUrl = 'http://127.0.0.1:5173';

  if (!isViteDev) {
    const dbPath = await ensureDatabasePath();
    const distDir = path.resolve(__dirname, '../dist');
    const iconsDir = app.isPackaged
      ? path.join(distDir, 'assets/icons/spells')
      : path.resolve(__dirname, '../public/assets/icons/spells');
    localServer = await startLocalServer({ dbPath, distDir, iconsDir });
    targetUrl = `http://127.0.0.1:${localServer.port}`;
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'PF2e Manager',
    icon: path.join(__dirname, app.isPackaged ? '../dist/assets/app-icon.png' : '../public/assets/app-icon.png'),
    backgroundColor: '#0e1217',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  let allowClose = false;
  mainWindow.on('close', (event) => {
    if (allowClose) return;
    event.preventDefault();
    mainWindow.webContents.send('request-close');
  });
  ipcMain.on('allow-close', (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    allowClose = true;
    mainWindow.close();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    ipcMain.removeAllListeners('allow-close');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(targetUrl)) {
      event.preventDefault();
    }
  });

  await mainWindow.loadURL(targetUrl);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  if (localServer) {
    localServer.close();
    localServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
