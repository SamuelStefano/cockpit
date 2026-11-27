import { app, globalShortcut, Menu, nativeImage, Tray, type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { showWindow } from './bridge';
import { loadSettings, saveSettings } from './settings';

const HOTKEY = 'CommandOrControl+Shift+D';
export const HIDDEN_ARG = '--hidden';

function toggle(win: BrowserWindow): void {
  if (win.isVisible() && win.isFocused()) win.hide();
  else showWindow(win);
}

function applyHotkey(win: BrowserWindow, on: boolean): boolean {
  globalShortcut.unregister(HOTKEY);
  return on ? globalShortcut.register(HOTKEY, () => toggle(win)) : false;
}

// Autostart and the hotkey stay in this native menu: page code cannot reach them,
// so an XSS never gains persistence on the machine.
export function createTray(win: BrowserWindow): Tray {
  const tray = new Tray(nativeImage.createFromPath(join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 16, height: 16 }));
  const settings = loadSettings();
  let hotkey = applyHotkey(win, settings.globalHotkey);

  const render = () => {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Deck', click: () => showWindow(win) },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings({ args: [HIDDEN_ARG] }).openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: [HIDDEN_ARG] }),
      },
      {
        label: 'Global shortcut (Ctrl+Shift+D)',
        type: 'checkbox',
        checked: hotkey,
        click: (item) => {
          hotkey = applyHotkey(win, item.checked);
          saveSettings({ globalHotkey: hotkey });
          render();
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  };
  render();
  tray.setToolTip('Deck');
  tray.on('click', () => showWindow(win));
  return tray;
}
