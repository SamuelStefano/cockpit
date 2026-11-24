import { app, dialog, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

// The web UI updates by itself; this only replaces the shell. The feed and its
// sha512 come from the repo's releases, the same trust root as the boxes' self-update.
export function startUpdater(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on('error', (e) => console.error('[deck] update failed:', e.message));
  autoUpdater.on('update-downloaded', ({ version }) => {
    const options = {
      type: 'info' as const,
      title: 'Deck',
      message: `Deck ${version} is ready`,
      detail: 'Restart now, or it installs the next time the app quits.',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      cancelId: 1,
    };
    const win = getWindow();
    void (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
  const check = () => { autoUpdater.checkForUpdates().catch((e: Error) => console.error('[deck] update check failed:', e.message)); };
  check();
  setInterval(check, CHECK_EVERY_MS).unref();
}
