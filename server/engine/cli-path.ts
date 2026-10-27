import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// The one npm prefix the Deck installs and updates the CLI in. `claude update` and
// the CLI's own auto-updater install into npm's default prefix (next to node), so
// without NPM_CONFIG_PREFIX pinned to this they landed in a second install the
// agent never ran: 2.1.197 kept answering "does not support this model".
export function managedPrefix(home = homedir()): string {
  return join(home, '.deck-npm');
}

// Set when the managed install is behind another one on the box and npm is out of
// reach (cli-update.ts); the newest binary wins until the managed one catches up.
let preferred: string | null = null;
export function setPreferredCliDir(dir: string | null): void { preferred = dir; }

// The supervisors run for weeks with the PATH of the shell that started them, so
// every spawn('claude') goes through this instead: managed prefix first, then the
// native install (~/.local/bin, kept current by `claude update`), then the rest.
export function cliPath(): string {
  const base = process.env.PATH ?? '';
  const home = homedir();
  const dirs = [preferred, join(managedPrefix(home), 'bin'), join(home, '.local', 'bin'), join(home, '.claude', 'local')];
  const front = [...new Set(dirs.filter((d): d is string => !!d && existsSync(join(d, 'claude'))))];
  return front.length ? `${front.join(':')}:${base}` : base;
}

export function resolveCli(path = cliPath(), exists: (p: string) => boolean = existsSync): string {
  for (const dir of path.split(':')) {
    if (dir && exists(join(dir, 'claude'))) return join(dir, 'claude');
  }
  return '';
}
