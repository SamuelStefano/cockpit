import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { detachedGroup, killGroup } from './platform';
import { teamFile } from './team-log';

export interface ExecutorConfig { label: string; probe: string[]; run: string[]; timeoutMin: number; stallMin: number }

export const PROBE_TIMEOUT_MS = 15_000;
const DEFAULTS = { timeoutMin: 30, maxTimeoutMin: 180, stallMin: 10 } as const;

export function executorFile(): string {
  return process.env.COCKPIT_EXECUTOR ?? join(dirname(teamFile()) || homedir(), 'executor.json');
}

const argv = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0 && !x.includes('\0')) ? (v as string[]) : null;

const minutes = (v: unknown, fallback: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(v, max) : fallback;

// Read on every use. The argv templates never leave the server: clients only see the label.
export function readExecutorConfig(): ExecutorConfig | null {
  try {
    const j = JSON.parse(readFileSync(executorFile(), 'utf8')) as Record<string, unknown>;
    const probe = argv(j.probe);
    const run = argv(j.run);
    const label = typeof j.label === 'string' ? j.label.trim().slice(0, 40) : '';
    if (!probe || !run || !label) return null;
    return { label, probe, run, timeoutMin: minutes(j.timeoutMin, DEFAULTS.timeoutMin, DEFAULTS.maxTimeoutMin), stallMin: minutes(j.stallMin, DEFAULTS.stallMin, 24 * 60) };
  } catch { return null; }
}

export const executorConfigured = (): boolean => readExecutorConfig() !== null;

export interface RunHandle { kill: () => void }
export interface RunHandlers { onData: (chunk: string) => void; onExit: (code: number | null, error?: string) => void }

// No shell: argv[0] is executed directly with the rest as its arguments, in its own
// process group so killGroup (SIGKILL to the group, taskkill /T on Windows) takes the tree.
export function spawnArgv(args: string[], h: RunHandlers): RunHandle {
  let done = false;
  const finish = (code: number | null, error?: string) => { if (!done) { done = true; h.onExit(code, error); } };
  const child = spawn(args[0], args.slice(1), { shell: false, detached: detachedGroup, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout?.on('data', (b: Buffer) => h.onData(b.toString('utf8')));
  child.stderr?.on('data', (b: Buffer) => h.onData(b.toString('utf8')));
  child.on('error', (e) => finish(null, e.message));
  child.on('close', (code) => finish(code));
  return { kill: () => killGroup(child) };
}

export function probeArgv(args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const end = (ok: boolean) => { if (!settled) { settled = true; clearTimeout(timer); resolve(ok); } };
    const handle = spawnArgv(args, { onData: () => {}, onExit: (code) => end(code === 0) });
    const timer = setTimeout(() => { handle.kill(); end(false); }, PROBE_TIMEOUT_MS);
  });
}
