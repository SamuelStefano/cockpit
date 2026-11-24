import { app } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Settings {
  globalHotkey: boolean;
}

const file = () => join(app.getPath('userData'), 'settings.json');

export function loadSettings(): Settings {
  try {
    const v = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Settings>;
    return { globalHotkey: v.globalHotkey === true };
  } catch {
    return { globalHotkey: false };
  }
}

export function saveSettings(s: Settings): void {
  try {
    writeFileSync(file(), JSON.stringify(s));
  } catch {
    // A lost preference is not worth failing for.
  }
}
