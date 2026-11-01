import { contextBridge, ipcRenderer } from 'electron';

// Sandboxed preloads cannot require local files, so the version comes as an argument.
const version = process.argv.find((a) => a.startsWith('--deck-version='))?.slice('--deck-version='.length) ?? '';

contextBridge.exposeInMainWorld('deckDesktop', {
  apiVersion: 1,
  appVersion: version,
  focusWindow: () => ipcRenderer.send('deck:focus-window'),
  setBadge: (count: number) => ipcRenderer.send('deck:set-badge', count),
});
