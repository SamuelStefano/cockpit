import { app, BrowserWindow } from 'electron';
import { hardenPermissions } from './security';
import { startUpdater } from './updater';
import { createMainWindow } from './window';

app.enableSandbox();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win: BrowserWindow | null = null;

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.on('window-all-closed', () => app.quit());

  void app.whenReady().then(() => {
    hardenPermissions();
    win = createMainWindow();
    win.on('closed', () => { win = null; });
    startUpdater(() => win);
  });
}
