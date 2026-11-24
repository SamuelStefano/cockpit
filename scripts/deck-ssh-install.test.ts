import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
// @ts-expect-error plain mjs helper
import { parseArgs, validate, buildSshArgs, remoteCommand, run } from './deck-ssh-install.mjs';

const ok = { target: 'me@box.example.com', identity: '', port: '', trustNewHost: false, dryRun: false };

describe('deck-ssh-install', () => {
  it('rejects option-injection and malformed targets', () => {
    for (const t of ['-oProxyCommand=x@h', 'a b@host', 'host', 'u@h;rm', 'u@$(x)', 'u@']) {
      expect(() => validate({ ...ok, target: t }, 'ABCD1234')).toThrow();
    }
    expect(() => validate({ ...ok, target: 'root@[::1]' }, 'ABCD1234')).not.toThrow();
  });

  it('validates code, port and key path', () => {
    expect(() => validate(ok, 'x y')).toThrow();
    expect(() => validate(ok, '')).toThrow();
    expect(() => validate({ ...ok, port: '70000' }, 'ABCD1234')).toThrow();
    expect(() => validate({ ...ok, identity: '-oFoo' }, 'ABCD1234')).toThrow();
  });

  it('never disables host-key checking and puts -- before the target', () => {
    const a = buildSshArgs(ok);
    expect(a).toContain('StrictHostKeyChecking=yes');
    expect(a.join(' ')).not.toMatch(/StrictHostKeyChecking=no|UserKnownHostsFile=\/dev\/null/);
    expect(a[a.indexOf('--') + 1]).toBe(ok.target);
    expect(buildSshArgs({ ...ok, trustNewHost: true })).toContain('StrictHostKeyChecking=accept-new');
  });

  it('uses the key path only and keeps the remote command constant', () => {
    const a = buildSshArgs({ ...ok, identity: '/home/u/.ssh/id_ed25519', port: '2222' });
    expect(a).toEqual(expect.arrayContaining(['-i', '/home/u/.ssh/id_ed25519', 'IdentitiesOnly=yes', '-p', '2222']));
    expect(a[a.length - 1]).toBe(remoteCommand());
    expect(remoteCommand()).not.toMatch(/ABCD1234/);
  });

  it('parses args and rejects unknown flags', () => {
    expect(parseArgs(['me@h', '-i', 'k', '--dry-run']).identity).toBe('k');
    expect(() => parseArgs(['--bad'])).toThrow();
    expect(() => parseArgs(['a@b', 'c@d'])).toThrow();
  });

  it('is disabled without the flag', async () => {
    const spawnFn = vi.fn();
    const log = vi.fn();
    expect(await run(['me@h'], { DECK_PAIR_CODE: 'ABCD1234' }, spawnFn, log)).toBe(2);
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it('dry-run runs nothing and redacts the code', async () => {
    const spawnFn = vi.fn();
    const log = vi.fn();
    const rc = await run(['me@h.io', '--dry-run'], { DECK_SSH_ONBOARDING: '1', DECK_PAIR_CODE: 'SECRETCODE1' }, spawnFn, log);
    expect(rc).toBe(0);
    expect(spawnFn).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('SECRETCODE1');
  });

  it('sends the code over stdin, not argv', async () => {
    const child: any = new EventEmitter();
    const chunks: string[] = [];
    child.stdin = Object.assign(new EventEmitter(), { end: (s: string) => { chunks.push(s); queueMicrotask(() => child.emit('close', 0)); } });
    const spawnFn = vi.fn(() => child);
    const rc = await run(['me@h.io'], { DECK_SSH_ONBOARDING: '1', DECK_PAIR_CODE: 'SECRETCODE1' }, spawnFn, vi.fn());
    expect(rc).toBe(0);
    expect(chunks).toEqual(['SECRETCODE1\n']);
    const [bin, args, o] = spawnFn.mock.calls[0] as any[];
    expect(bin).toBe('ssh');
    expect(o.shell).toBe(false);
    expect(args.join(' ')).not.toContain('SECRETCODE1');
  });
});
