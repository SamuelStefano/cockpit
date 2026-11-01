import { contextBridge, ipcRenderer } from 'electron';

// Sandboxed preloads cannot require local files, so the version comes as an argument.
const version = process.argv.find((a) => a.startsWith('--deck-version='))?.slice('--deck-version='.length) ?? '';

interface DeckLink { box: string | null; session: string }
let pending: DeckLink | null = null;
let listener: ((link: DeckLink) => void) | null = null;

// A cold-start link can arrive before React mounts, so the last one waits here.
ipcRenderer.on('deck:link', (_event, link: DeckLink) => {
  if (listener) listener(link);
  else pending = link;
});

contextBridge.exposeInMainWorld('deckDesktop', {
  apiVersion: 2,
  appVersion: version,
  focusWindow: () => ipcRenderer.send('deck:focus-window'),
  setBadge: (count: number) => ipcRenderer.send('deck:set-badge', count),
  onLink: (cb: (link: DeckLink) => void) => {
    listener = cb;
    if (pending) cb(pending);
    pending = null;
  },
});
