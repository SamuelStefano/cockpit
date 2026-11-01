import { app, BrowserWindow } from 'electron';
import { registerBridge, showWindow } from './bridge';
import { hardenPermissions } from './security';
import { startUpdater } from './updater';
import { createMainWindow } from './window';

app.enableSandbox();
app.setAppUserModelId('com.devfellowship.deck');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win: BrowserWindow | null = null;

  app.on('second-instance', () => {
    if (win) showWindow(win);
  });

  app.on('window-all-closed', () => app.quit());

  void app.whenReady().then(() => {
    hardenPermissions();
    win = createMainWindow();
    registerBridge(win);
    win.on('closed', () => { win = null; });
    startUpdater(() => win);
  });
}
