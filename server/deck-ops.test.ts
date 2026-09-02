import { describe, it, expect, vi, beforeEach } from 'vitest';

const cp = vi.hoisted(() => ({
  execFile: vi.fn(),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));
vi.mock('node:child_process', () => cp);
vi.mock('node:fs', async (orig) => ({ ...(await orig<typeof import('node:fs')>()), mkdirSync: vi.fn(), openSync: vi.fn(() => 9) }));
vi.mock('./engine/cli-path', () => ({ cliPath: () => '/home/x/.local/bin:/usr/bin' }));

import { parseCliVersion, restartDeck, claudeCliInfo, REPO_ROOT } from './deck-ops';

type Cb = (err: Error | null, out?: { stdout: string; stderr: string }) => void;
function fakeExec(impl: (cmd: string, args: string[]) => { stdout: string } | Error) {
  cp.execFile.mockImplementation((cmd: string, args: string[], _opts: unknown, cb: Cb) => {
    const r = impl(cmd, args);
    if (r instanceof Error) cb(r); else cb(null, { stdout: r.stdout, stderr: '' });
  });
}

beforeEach(() => { vi.clearAllMocks(); });

describe('parseCliVersion', () => {
  it('extracts the semver from `claude --version`', () => {
    expect(parseCliVersion('2.1.258 (Claude Code)\n')).toBe('2.1.258');
    expect(parseCliVersion('')).toBe('');
  });
});

describe('claudeCliInfo', () => {
  it('reports the binary the spawn resolves, with ~ for the home dir', async () => {
    const home = process.env.HOME ?? '';
    fakeExec((cmd) => cmd === 'claude' ? { stdout: '2.1.258 (Claude Code)\n' } : { stdout: `${home}/.local/bin/claude\n` });
    expect(await claudeCliInfo()).toEqual({ version: '2.1.258', path: '~/.local/bin/claude' });
    const env = (cp.execFile.mock.calls[0][2] as { env: { PATH: string } }).env;
    expect(env.PATH).toBe('/home/x/.local/bin:/usr/bin');
  });

  it('degrades to empty strings when the CLI is missing', async () => {
    fakeExec(() => new Error('ENOENT'));
    expect(await claudeCliInfo()).toEqual({ version: '', path: '' });
  });
});

describe('restartDeck', () => {
  it('idle: does not spawn a second watcher when one already holds the lock', async () => {
    fakeExec((cmd) => cmd === 'flock' ? new Error('locked') : { stdout: '' });
    const r = await restartDeck('idle');
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/já estava agendado/);
    expect(cp.spawn).not.toHaveBeenCalled();
  });

  it('idle: spawns deploy-when-idle.sh detached from this checkout', async () => {
    fakeExec(() => ({ stdout: '' }));
    await restartDeck('idle');
    expect(cp.spawn).toHaveBeenCalledWith('bash', [`${REPO_ROOT}/scripts/deploy-when-idle.sh`], expect.objectContaining({ cwd: REPO_ROOT, detached: true }));
  });

  it('now: spawns redeploy.sh without consulting the lock', async () => {
    fakeExec((cmd) => cmd === 'flock' ? new Error('locked') : { stdout: '' });
    await restartDeck('now');
    expect(cp.spawn).toHaveBeenCalledWith('bash', [`${REPO_ROOT}/scripts/redeploy.sh`], expect.objectContaining({ cwd: REPO_ROOT, detached: true }));
  });
});
