import { app, BrowserWindow, Menu, screen } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ORIGIN, hardenNavigation } from './security';
import { MIN_HEIGHT, MIN_WIDTH, parseWindowState } from './window-state';

const RETRY_MS = 5000;

function stateFile(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

function readState(): string | null {
  try {
    return readFileSync(stateFile(), 'utf8');
  } catch {
    return null;
  }
}

function saveState(win: BrowserWindow): void {
  const b = win.getNormalBounds();
  try {
    writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    // Losing the window position is not worth failing for.
  }
}

function isOnScreen(x: number | undefined, y: number | undefined): boolean {
  if (x === undefined || y === undefined) return false;
  return screen.getAllDisplays().some(({ workArea: a }) =>
    x >= a.x && x < a.x + a.width && y >= a.y && y < a.y + a.height);
}

function attachContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, p) => {
    const template: Electron.MenuItemConstructorOptions[] = [
      ...p.dictionarySuggestions.map((word) => ({
        label: word,
        click: () => win.webContents.replaceMisspelling(word),
      })),
      ...(p.dictionarySuggestions.length ? [{ type: 'separator' as const }] : []),
      ...(p.isEditable ? [{ role: 'cut' as const }] : []),
      ...(p.selectionText || p.isEditable ? [{ role: 'copy' as const }] : []),
      ...(p.isEditable ? [{ role: 'paste' as const }, { role: 'selectAll' as const }] : []),
    ];
    if (template.length) Menu.buildFromTemplate(template).popup({ window: win });
  });
}

// The offline page is local and has no script, so failing to reach the app can
// never hand control to anything but this retry loop.
function attachOfflineRetry(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined;
  win.webContents.on('did-fail-load', (_event, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !url.startsWith(APP_ORIGIN)) return;
    void win.loadFile(join(__dirname, '..', 'assets', 'offline.html'));
    clearTimeout(timer);
    timer = setTimeout(() => { if (!win.isDestroyed()) void win.loadURL(APP_ORIGIN); }, RETRY_MS);
  });
  win.on('closed', () => clearTimeout(timer));
}

export function createMainWindow(): BrowserWindow {
  const state = parseWindowState(readState());
  const placed = isOnScreen(state.x, state.y);
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: placed ? state.x : undefined,
    y: placed ? state.y : undefined,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: '#101013',
    title: 'Deck',
    icon: join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      spellcheck: true,
    },
  });
  if (state.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveState(win));
  hardenNavigation(win.webContents);
  attachContextMenu(win);
  attachOfflineRetry(win);
  void win.loadURL(APP_ORIGIN);
  return win;
}
