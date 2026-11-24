import { describe, it, expect, vi, beforeEach } from 'vitest';

// The real runner spawns `tsx server/dfl-sync.ts`, which authenticates against
// DFL production: never let the test reach it.
const child = vi.hoisted(() => ({ calls: 0, release: null as null | (() => void), fail: null as null | Error }));
vi.mock('node:child_process', async (orig) => {
  const real = await orig<typeof import('node:child_process')>();
  return {
    ...real,
    execFile: (_cmd: string, _args: unknown, _opts: unknown, cb: (e: Error | null, r: { stdout: string; stderr: string }) => void) => {
      child.calls++;
      child.release = () => cb(child.fail, { stdout: '', stderr: '' });
    },
  };
});

const { runDflSync, isDflSyncRunning } = await import('./dfl-sync-runner');

beforeEach(() => { child.calls = 0; child.release = null; child.fail = null; });

describe('runDflSync', () => {
  it('coalesces: a second request while one runs spawns nothing', async () => {
    const first = runDflSync();
    expect(isDflSyncRunning()).toBe(true);
    const second = await runDflSync();
    expect(second).toEqual({ ok: true });
    expect(child.calls).toBe(1);
    child.release!();
    expect(await first).toEqual({ ok: true });
    expect(isDflSyncRunning()).toBe(false);
  });

  it('reports a failed child and frees the slot for the next sync', async () => {
    child.fail = new Error('exit 1');
    const p = runDflSync();
    child.release!();
    expect(await p).toEqual({ ok: false, error: 'exit 1' });
    expect(isDflSyncRunning()).toBe(false);
    const next = runDflSync();
    expect(child.calls).toBe(2);
    child.fail = null;
    child.release!();
    expect(await next).toEqual({ ok: true });
  });
});
