/**
 * Thinkia — cliente escritorio (Electron).
 * Carga el mismo portal que en Vercel; Twilio/Supabase siguen en el servidor.
 */
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_PORTAL = 'https://thinkia-fresenius-call-center2.vercel.app/portal/';

// WebRTC audio (Twilio) usa <audio autoplay>. En algunos entornos Windows/Electron puede quedar bloqueado
// si Chromium exige gesto. Forzamos política permisiva para evitar “llamada conectada pero sin audio”.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function portalBaseUrl() {
  try {
    const jPath = path.join(__dirname, 'portal-url.json');
    if (fs.existsSync(jPath)) {
      const j = JSON.parse(fs.readFileSync(jPath, 'utf8'));
      if (typeof j.base === 'string' && j.base.trim()) {
        const b = j.base.trim();
        return b.endsWith('/') ? b : `${b}/`;
      }
    }
  } catch {
    /* ignore */
  }
  const e = process.env.THINKIA_WEB_URL?.trim();
  if (e) return e.endsWith('/') ? e : `${e}/`;
  return DEFAULT_PORTAL;
}

function setApplicationMenu() {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
      ]),
    );
    return;
  }
  Menu.setApplicationMenu(null);
}

function createWindow() {
  const startUrl = portalBaseUrl();
  const allowedOrigin = (() => {
    try {
      return new URL(startUrl).origin;
    } catch {
      return '';
    }
  })();

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Thinkia',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media' || permission === 'display-capture') {
      callback(true);
      return;
    }
    callback(false);
  });

  win.webContents.on('did-finish-load', () => {
    try {
      win.webContents.setAudioMuted(false);
    } catch {
      /* ignore */
    }
  });

  if (allowedOrigin) {
    win.webContents.on('will-navigate', (event, url) => {
      try {
        if (!url.startsWith(allowedOrigin)) event.preventDefault();
      } catch {
        event.preventDefault();
      }
    });
  }

  win.loadURL(startUrl).catch((err) => {
    console.error('loadURL failed', err);
  });
}

app.whenReady().then(() => {
  setApplicationMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
