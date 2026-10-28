import { join } from 'node:path';
import { format } from 'node:util';
import type { BootCheck, BootFs } from './self-update-boot';
import { AGENT_DIAG_LINES, AGENT_DIAG_LINE_MAX, isDiagKind, redactText } from '../shared/diag';

// The agent's half of the diag reports (relay migration 0008): what went wrong on
// the previous run is written to disk and sent to the relay once the next run is
// authenticated, so the admin learns about a crash loop or a failed self-update
// without logging into the box. Node builtins + shared/diag only: agent.ts runs
// this before any app module loads.

export const errorsFile = (dir: string) => join(dir, 'diag-errors.json');
export const pendingFile = (dir: string) => join(dir, 'diag-pending.json');
export const runningFile = (dir: string) => join(dir, 'agent-running');

export interface PendingDiag { kind: string; lines: string[] }

function clean(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  return lines.filter((l): l is string => typeof l === 'string').slice(-AGENT_DIAG_LINES).map((l) => redactText(l.slice(0, AGENT_DIAG_LINE_MAX)));
}

export function readErrors(fs: BootFs, dir: string): string[] {
  try { return clean(JSON.parse(fs.read(errorsFile(dir)) ?? '[]')); } catch { return []; }
}

export function writePending(fs: BootFs, dir: string, kind: string, extra: string[] = []): void {
  if (!isDiagKind(kind)) return;
  try { fs.write(pendingFile(dir), JSON.stringify({ kind, lines: clean([...readErrors(fs, dir), ...extra]) })); } catch { /* best effort */ }
}

export function takePending(fs: BootFs, dir: string): PendingDiag | null {
  const raw = fs.read(pendingFile(dir));
  if (raw === null) return null;
  fs.remove(pendingFile(dir));
  try {
    const m = JSON.parse(raw) as { kind?: unknown; lines?: unknown };
    return isDiagKind(m.kind) ? { kind: m.kind, lines: clean(m.lines) } : null;
  } catch { return null; }
}

// Called at boot. A rollback (or a failed one) is reported as such; otherwise a
// leftover running marker means the last run never reached a clean exit (OOM
// kill, SIGKILL, power loss), which the crash handler could not record.
export function noteBoot(fs: BootFs, dir: string, check: BootCheck): void {
  const unclean = fs.read(runningFile(dir)) !== null;
  if (check === 'rolled-back') writePending(fs, dir, 'self-update-rollback');
  else if (check === 'rollback-failed') writePending(fs, dir, 'self-update-rollback-failed');
  else if (unclean && fs.read(pendingFile(dir)) === null) writePending(fs, dir, 'unclean-exit');
  try { fs.write(runningFile(dir), String(Date.now())); } catch { /* best effort */ }
}

export function noteCleanExit(fs: BootFs, dir: string): void {
  try { fs.remove(runningFile(dir)); } catch { /* best effort */ }
}

// Keeps the last AGENT_DIAG_LINES console.error lines, mirrored to disk (debounced)
// so they survive the crash that a report is about.
export function captureErrors(fs: BootFs, dir: string, target: { error: (...a: unknown[]) => void } = console, debounceMs = 1000) {
  const ring = readErrors(fs, dir);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => { timer = null; try { fs.write(errorsFile(dir), JSON.stringify(ring)); } catch { /* best effort */ } };
  const orig = target.error.bind(target);
  target.error = (...args: unknown[]) => {
    orig(...args);
    const at = new Date().toISOString();
    for (const l of format(...args).split('\n').slice(0, 20)) ring.push(`${at} ${l}`.slice(0, AGENT_DIAG_LINE_MAX));
    if (ring.length > AGENT_DIAG_LINES) ring.splice(0, ring.length - AGENT_DIAG_LINES);
    if (!timer) { timer = setTimeout(flush, debounceMs); timer.unref?.(); }
  };
  return { lines: () => [...ring], flush: () => { if (timer) clearTimeout(timer); flush(); } };
}

export function diagFrame(p: PendingDiag, version?: string): string {
  return JSON.stringify({ t: 'diag-report', kind: p.kind, lines: p.lines, ...(version ? { version } : {}) });
}
