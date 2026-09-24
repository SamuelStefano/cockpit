import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn as ptySpawn } from 'node-pty';
import { closeTerm, watchedElsewhere } from './terminals';

// Private tmux server (own socket dir), never the live one hosting the Deck terminals.
describe('closeTerm against a real tmux', () => {
  const id = `audit-${process.pid}`;
  const saved = { tmpdir: process.env.TMUX_TMPDIR, tmux: process.env.TMUX };
  beforeAll(() => {
    process.env.TMUX_TMPDIR = mkdtempSync(join(tmpdir(), 'tmux-test-'));
    delete process.env.TMUX;
  });
  afterAll(() => {
    try { execFileSync('tmux', ['kill-server']); } catch { /* no server */ }
    if (saved.tmpdir === undefined) delete process.env.TMUX_TMPDIR; else process.env.TMUX_TMPDIR = saved.tmpdir;
    if (saved.tmux !== undefined) process.env.TMUX = saved.tmux;
  });

  const alive = (name: string) => {
    try { execFileSync('tmux', ['has-session', '-t', `=${name}`], { stdio: 'ignore' }); return true; } catch { return false; }
  };

  it('closing a terminal that is already gone leaves a sibling with a longer name alive', async () => {
    execFileSync('tmux', ['new-session', '-d', '-s', `cockpit-${id}-2`]);
    closeTerm(id);
    await new Promise((r) => setTimeout(r, 400));
    expect(alive(`cockpit-${id}-2`)).toBe(true);
  });

  it('still kills the exact session', async () => {
    execFileSync('tmux', ['new-session', '-d', '-s', `cockpit-${id}`]);
    closeTerm(id);
    await vi.waitFor(() => expect(alive(`cockpit-${id}`)).toBe(false), { timeout: 2000 });
  });

  it('counts a client attached through another process as watched', async () => {
    const w = `w-${id}`;
    execFileSync('tmux', ['new-session', '-d', '-s', `cockpit-${w}`]);
    expect(await watchedElsewhere(w)).toBe(false);
    const other = ptySpawn('tmux', ['attach-session', '-t', `=cockpit-${w}`], { name: 'xterm-256color', cols: 80, rows: 24, env: process.env as Record<string, string> });
    try {
      await vi.waitFor(async () => expect(await watchedElsewhere(w)).toBe(true), { timeout: 3000 });
    } finally {
      other.kill();
      closeTerm(w);
    }
  });
});
