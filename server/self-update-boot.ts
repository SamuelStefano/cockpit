import { npmInvocation } from './platform';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

// Rollback of a self-update whose code never comes up. Node builtins only: this
// runs from the entry point before any app module loads, so a broken update
// cannot stop it from running.

export interface UpdateMarker { from: string; to: string; boots: number }

export interface BootFs {
  read: (file: string) => string | null;
  write: (file: string, data: string) => void;
  remove: (file: string) => void;
}

export interface BootDeps extends BootFs {
  git: (args: string[]) => boolean | string;
  npmCi: () => boolean;
  log: (msg: string) => void;
}

export type BootCheck = 'none' | 'stale' | 'counted' | 'rolled-back' | 'rollback-failed';

export const MAX_BOOTS = 3;
export const CONFIRM_UPTIME_MS = 2 * 60_000;
const MAX_BAD = 50;
const SHA = /^[0-9a-f]{40}$/;
const DEP_FILES = ['package.json', 'package-lock.json'];

export function agentDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.DECK_AGENT_DIR || join(homedir(), '.deck-agent');
}

export const markerFile = (dir: string) => join(dir, 'self-update.json');
export const badFile = (dir: string) => join(dir, 'self-update-bad.json');

export function readMarker(fs: BootFs, dir: string): UpdateMarker | null {
  try {
    const m = JSON.parse(fs.read(markerFile(dir)) ?? 'null') as UpdateMarker | null;
    return m && SHA.test(m.from) && SHA.test(m.to) && Number.isInteger(m.boots) ? m : null;
  } catch { return null; }
}

export function writeMarker(fs: BootFs, dir: string, m: UpdateMarker): void {
  fs.write(markerFile(dir), JSON.stringify(m));
}

export function readBad(fs: BootFs, dir: string): string[] {
  try {
    const list = JSON.parse(fs.read(badFile(dir)) ?? '[]');
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  } catch { return []; }
}

export function addBad(fs: BootFs, dir: string, sha: string): void {
  const list = readBad(fs, dir).filter((s) => s !== sha);
  fs.write(badFile(dir), JSON.stringify([...list, sha].slice(-MAX_BAD)));
}

// Each start after an update counts; a start that finds MAX_BOOTS already
// counted means the new code never confirmed itself that many times.
export function checkBootAfterUpdate(d: BootDeps, dir: string): BootCheck {
  const m = readMarker(d, dir);
  if (!m) { d.remove(markerFile(dir)); return 'none'; }
  const head = d.git(['rev-parse', 'HEAD']);
  if (typeof head !== 'string' || head.trim() !== m.to) { d.remove(markerFile(dir)); return 'stale'; }
  if (m.boots < MAX_BOOTS) { writeMarker(d, dir, { ...m, boots: m.boots + 1 }); return 'counted'; }

  const changed = d.git(['diff', '--name-only', m.from, m.to, '--', ...DEP_FILES]);
  addBad(d, dir, m.to);
  d.remove(markerFile(dir));
  if (d.git(['reset', '-q', '--hard', m.from]) === false) {
    d.log(`[agent] self-update: ${short(m.to)} failed to boot ${MAX_BOOTS}x and the rollback to ${short(m.from)} failed`);
    return 'rollback-failed';
  }
  if ((changed === false || (typeof changed === 'string' && changed.trim())) && !d.npmCi()) {
    d.log('[agent] self-update: restoring the previous dependencies failed');
  }
  d.log(`[agent] self-update: ${short(m.to)} failed to boot ${MAX_BOOTS}x, rolled back to ${short(m.from)}`);
  return 'rolled-back';
}

// The update is good once the agent stayed up CONFIRM_UPTIME_MS and reached the relay.
export function bootConfirmer(fs: BootFs, dir: string, startedAt: number, now: () => number) {
  let connected = false, done = false;
  const check = () => {
    if (done || !connected || now() - startedAt < CONFIRM_UPTIME_MS) return;
    done = true;
    if (readMarker(fs, dir)) fs.remove(markerFile(dir));
  };
  return { connected: () => { connected = true; check(); }, check };
}

function short(sha: string): string { return sha.slice(0, 7); }

export const realFs: BootFs = {
  read: (f) => { try { return readFileSync(f, 'utf8'); } catch { return null; } },
  write: (f, data) => {
    mkdirSync(dirname(f), { recursive: true, mode: 0o700 });
    const tmp = `${f}.${process.pid}.tmp`;
    writeFileSync(tmp, data, { mode: 0o600 });
    renameSync(tmp, f);
  },
  remove: (f) => { if (existsSync(f)) rmSync(f, { force: true }); },
};

// npm next to the running node, so a unit whose PATH lacks it still finds it.
export function npmBesideNode(execPath = process.execPath): string {
  const bin = join(dirname(execPath), 'npm');
  return existsSync(bin) ? bin : 'npm';
}

export function realBootDeps(cwd: string): BootDeps {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  const run = (cmd: string, args: string[], timeout: number): boolean | string => {
    const [bin, argv] = npmInvocation(cmd, args);
    try { return execFileSync(bin, argv, { cwd, env, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return false; }
  };
  return {
    ...realFs,
    git: (args) => run('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], 60_000),
    npmCi: () => run(npmBesideNode(), ['ci', '--no-audit', '--no-fund'], 15 * 60_000) !== false,
    log: (m) => console.error(m),
  };
}
