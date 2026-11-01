import { app, globalShortcut, type BrowserWindow, type Tray } from 'electron';
import { registerBridge, showWindow } from './bridge';
import { deckLinkFromArgv, type DeckLink } from './deep-link';
import { hardenPermissions } from './security';
import { createTray, HIDDEN_ARG } from './tray';
import { createMainWindow } from './window';

app.enableSandbox();
app.setAppUserModelId('com.devfellowship.deck');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win: BrowserWindow | null = null;
  let tray: Tray | null = null;
  let quitting = false;

  const openLink = (link: DeckLink) => {
    if (!win) return;
    showWindow(win);
    win.webContents.send('deck:link', link);
  };

  app.setAsDefaultProtocolClient('deck');

  app.on('second-instance', (_event, argv) => {
    if (win) showWindow(win);
    const link = deckLinkFromArgv(argv);
    if (link) openLink(link);
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());

  void app.whenReady().then(() => {
    hardenPermissions();
    win = createMainWindow({ startHidden: process.argv.includes(HIDDEN_ARG) });
    registerBridge(win);
    tray = createTray(win);
    win.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      win?.hide();
    });
    win.on('closed', () => { win = null; tray?.destroy(); });
    const link = deckLinkFromArgv(process.argv);
    if (link) win.webContents.once('did-finish-load', () => openLink(link));
  });
}
