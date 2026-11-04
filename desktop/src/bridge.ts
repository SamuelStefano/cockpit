import { ipcMain, nativeImage, type BrowserWindow, type IpcMainEvent } from 'electron';
import { badgeGlyph, renderBadge } from './badge';
import { trustedSender, validBadgeCount } from './bridge-rules';

function trusted(win: BrowserWindow, event: IpcMainEvent): boolean {
  const frame = event.senderFrame;
  return !!frame && event.sender === win.webContents
    && trustedSender(frame.url, frame === win.webContents.mainFrame);
}

export function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function registerBridge(win: BrowserWindow): void {
  ipcMain.on('deck:focus-window', (event) => {
    if (trusted(win, event)) showWindow(win);
  });
  // Taskbar flashing replaces the toast; it ends on its own when the window gains focus.
  ipcMain.on('deck:flash-window', (event) => {
    if (trusted(win, event) && !win.isFocused()) win.flashFrame(true);
  });
  win.on('focus', () => win.flashFrame(false));
  ipcMain.on('deck:set-badge', (event, value: unknown) => {
    const count = validBadgeCount(value);
    if (count === null || !trusted(win, event)) return;
    const glyph = badgeGlyph(count);
    const icon = glyph ? nativeImage.createFromBitmap(renderBadge(glyph), { width: 16, height: 16 }) : null;
    win.setOverlayIcon(icon, glyph ? `${count} unread` : '');
  });
}
