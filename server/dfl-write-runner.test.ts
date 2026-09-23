import { describe, it, expect, vi, afterEach } from 'vitest';

// DFL_WRITE_DISABLED is the safety net a Playwright/manual test backend sets
// so it can drive the real dispatch.ts write handlers without ANY risk of a
// live DFL call — assert it refuses BEFORE ever spawning the child process
// (dfl-write.ts), not just that the eventual HTTP call would fail.
vi.mock('node:child_process', () => ({
  execFile: () => { throw new Error('execFile não deveria ter sido chamado — DFL_WRITE_DISABLED deveria ter barrado antes'); },
}));

const { runDflWrite, dflWritesDisabled } = await import('./dfl-write-runner');

afterEach(() => { delete process.env.DFL_WRITE_DISABLED; });

describe('dflWritesDisabled', () => {
  it('false por padrão (env var ausente)', () => {
    expect(dflWritesDisabled()).toBe(false);
  });
  it('true só com o valor exato "1"', () => {
    process.env.DFL_WRITE_DISABLED = '1';
    expect(dflWritesDisabled()).toBe(true);
    process.env.DFL_WRITE_DISABLED = 'true';
    expect(dflWritesDisabled()).toBe(false);
  });
});

describe('runDflWrite com DFL_WRITE_DISABLED=1', () => {
  it('recusa qualquer comando sem NUNCA spawnar o processo filho', async () => {
    process.env.DFL_WRITE_DISABLED = '1';
    const r = await runDflWrite({ kind: 'task-status', taskId: '11111111-1111-4111-8111-111111111111', status: 'done' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('DFL_WRITE_DISABLED');
  });
});
