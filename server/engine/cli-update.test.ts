import { describe, it, expect } from 'vitest';
import {
  createCliUpdater, compareVersions, parseCliVersion, isNativeInstall,
  FAIL_COOLDOWN_MS, MAX_BUSY_WAIT_MS, type CliExecResult, type CliUpdaterDeps,
} from './cli-update';

const MANAGED = '/home/deck/.deck-npm/bin/claude';
const OTHER = '/home/deck/.deck-node/bin/claude';

// A box: binary path -> version, npm's latest, and what an install does.
function box(o: {
  versions: Record<string, string>;
  latest?: string;
  installOk?: boolean;
  installTo?: string;
  resolve?: string;
  candidates?: string[];
  busy?: boolean;
  env?: NodeJS.ProcessEnv;
  real?: Record<string, string>;
  nativeTo?: string;
}) {
  const calls: string[] = [];
  let clock = 0;
  let preferred: string | null = null;
  const versions = { ...o.versions };
  const ok = (stdout = ''): CliExecResult => ({ ok: true, stdout, stderr: '' });
  const fail = (stderr = 'boom'): CliExecResult => ({ ok: false, stdout: '', stderr });
  const resolve = () => (preferred ? `${preferred}/claude` : (o.resolve ?? MANAGED));
  const deps: CliUpdaterDeps = {
    exec: async (cmd, args) => {
      calls.push([cmd, ...args].join(' '));
      if (args[0] === '--version') return versions[cmd] ? ok(`${versions[cmd]} (Claude Code)\n`) : fail();
      if (args[0] === 'view') return o.latest ? ok(`${o.latest}\n`) : fail('ENOTFOUND registry.npmjs.org');
      if (args[0] === 'install') {
        if (o.installOk === false) return fail('npm ERR! code EACCES\nnpm ERR! permission denied');
        versions[MANAGED] = o.installTo ?? o.latest ?? '9.9.9';
        return ok();
      }
      if (args[0] === 'update') { if (o.nativeTo) versions[cmd] = o.nativeTo; return ok(); }
      return fail();
    },
    now: () => clock,
    busy: () => !!o.busy,
    env: o.env ?? {},
    npmBin: 'npm',
    prefix: '/home/deck/.deck-npm',
    resolve,
    realpath: (p) => o.real?.[p] ?? p,
    candidates: () => o.candidates ?? [MANAGED],
    prefer: (d) => { preferred = d; },
    log: () => {},
  };
  return { u: createCliUpdater(deps), calls, versions, setLatest: (v: string) => { o.latest = v; }, tick: (ms: number) => { clock += ms; }, preferred: () => preferred };
}

describe('version helpers', () => {
  it('parses and compares', () => {
    expect(parseCliVersion('2.1.280 (Claude Code)')).toBe('2.1.280');
    expect(compareVersions('2.1.197', '2.1.280')).toBe(-1);
    expect(compareVersions('2.10.0', '2.9.9')).toBe(1);
    expect(compareVersions('2.1.280', '2.1.280')).toBe(0);
    expect(isNativeInstall('/home/x/.local/share/claude/versions/2.1.311')).toBe(true);
    expect(isNativeInstall('/home/x/.deck-npm/lib/node_modules/@anthropic-ai/claude-code/cli.js')).toBe(false);
  });
});

describe('check (periodic)', () => {
  it('updates a CLI behind npm latest in the managed prefix', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.300' });
    expect(await b.u.check()).toBe('updated');
    expect(b.calls).toContain('npm install -g --prefix /home/deck/.deck-npm --no-audit --no-fund @anthropic-ai/claude-code@latest');
    expect(b.versions[MANAGED]).toBe('2.1.300');
  });

  it('does nothing when current', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.300' }, latest: '2.1.300' });
    expect(await b.u.check()).toBe('current');
    expect(b.calls.some((c) => c.includes('install'))).toBe(false);
  });

  it('waits while turns run, then updates past the max wait', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.300', busy: true });
    expect(await b.u.check()).toBe('waiting');
    b.tick(MAX_BUSY_WAIT_MS);
    expect(await b.u.check()).toBe('updated');
  });

  it('honours DECK_CLI_AUTOUPDATE=off', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.300', env: { DECK_CLI_AUTOUPDATE: 'off' } });
    expect(await b.u.check()).toBe('disabled');
    expect(b.calls).toEqual([]);
  });

  it('migrates a box with two installs to the newest one when npm is out of reach', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197', [OTHER]: '2.1.280' }, candidates: [MANAGED, OTHER] });
    expect(await b.u.check()).toBe('offline');
    expect(b.preferred()).toBe('/home/deck/.deck-node/bin');
  });

  it('a managed install that caught up drops the preference', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197', [OTHER]: '2.1.280' }, candidates: [MANAGED, OTHER] });
    await b.u.check();
    expect(b.preferred()).toBe('/home/deck/.deck-node/bin');
    b.setLatest('2.1.300');
    expect(await b.u.check()).toBe('updated');
    expect(b.preferred()).toBeNull();
    expect(b.versions[MANAGED]).toBe('2.1.300');
  });
});

describe('heal (version error)', () => {
  it('updates to at least the required version', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.300' });
    const r = await b.u.heal('2.1.280');
    expect(r).toMatchObject({ ok: true, from: '2.1.197', to: '2.1.300' });
  });

  it('runs even with turns in flight', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.300', busy: true });
    expect((await b.u.heal('2.1.280')).ok).toBe(true);
  });

  it('is single-flight', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.300' });
    const [x, y] = await Promise.all([b.u.heal('2.1.280'), b.u.heal('2.1.280')]);
    expect(x).toBe(y);
    expect(b.calls.filter((c) => c.startsWith('npm install')).length).toBe(1);
  });

  it('reports a failed install and does not retry inside the cooldown', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.300', installOk: false });
    const r = await b.u.heal('2.1.280');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('permission denied');
    await b.u.heal('2.1.280');
    expect(b.calls.filter((c) => c.startsWith('npm install')).length).toBe(1);
    b.tick(FAIL_COOLDOWN_MS);
    await b.u.heal('2.1.280');
    expect(b.calls.filter((c) => c.startsWith('npm install')).length).toBe(2);
  });

  it('fails when npm still delivers a version below the required one', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, latest: '2.1.250', installTo: '2.1.250' });
    const r = await b.u.heal('2.1.280');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('2.1.280');
  });

  it('updates a native install in place before touching npm', async () => {
    const native = '/home/x/.local/bin/claude';
    const b = box({
      versions: { [native]: '2.1.197' }, resolve: native, nativeTo: '2.1.300',
      real: { [native]: '/home/x/.local/share/claude/versions/2.1.197' },
    });
    expect(await b.u.heal('2.1.280')).toMatchObject({ ok: true, to: '2.1.300' });
    expect(b.calls).toContain(`${native} update`);
    expect(b.calls.some((c) => c.startsWith('npm install'))).toBe(false);
  });

  it('refuses when auto-update is off', async () => {
    const b = box({ versions: { [MANAGED]: '2.1.197' }, env: { DECK_CLI_AUTOUPDATE: 'off' } });
    const r = await b.u.heal('2.1.280');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('DECK_CLI_AUTOUPDATE=off');
  });
});
