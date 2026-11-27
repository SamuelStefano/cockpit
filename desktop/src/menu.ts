import type { MenuItemConstructorOptions } from 'electron';

// The default menu ships reload and DevTools accelerators. A reload drops the live
// socket mid-turn, and DevTools in a release is one keypress away from pasted code.
export function appMenuTemplate(packaged: boolean): MenuItemConstructorOptions[] {
  return [
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn', accelerator: 'CommandOrControl+=' },
        { role: 'zoomOut' },
        ...(packaged ? [] : [{ role: 'reload' as const }, { role: 'toggleDevTools' as const }]),
      ],
    },
  ];
}
