import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { IS_WINDOWS } from '../platform';

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
  // npm puts global bins in the prefix root on Windows, in prefix/bin elsewhere.
  const dirs = [preferred, join(managedPrefix(home), IS_WINDOWS ? '' : 'bin'), join(home, '.local', 'bin'), join(home, '.claude', 'local')];
  const front = [...new Set(dirs.filter((d): d is string => !!d && !!cliInDir(d)))];
  return front.length ? [...front, base].join(delimiter) : base;
}

// The runnable CLI inside a dir. On Windows an npm install leaves a claude.cmd shim
// that Node cannot run without a shell, so it resolves to the claude.exe behind it.
export function cliInDir(dir: string, exists: (p: string) => boolean = existsSync, windows = IS_WINDOWS): string {
  if (!windows) return exists(join(dir, 'claude')) ? join(dir, 'claude') : '';
  const exe = join(dir, 'claude.exe');
  if (exists(exe)) return exe;
  const shimmed = join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  return exists(join(dir, 'claude.cmd')) && exists(shimmed) ? shimmed : '';
}

export function resolveCli(path = cliPath(), exists: (p: string) => boolean = existsSync, windows = IS_WINDOWS): string {
  for (const dir of path.split(windows ? ';' : ':')) {
    const found = dir ? cliInDir(dir, exists, windows) : '';
    if (found) return found;
  }
  return '';
}

// What to spawn. POSIX keeps the bare name, resolved through the PATH the child gets.
// Windows needs the real .exe: CreateProcess does not look at that PATH.
export function claudeBin(): string {
  return IS_WINDOWS ? resolveCli() || 'claude' : 'claude';
}
