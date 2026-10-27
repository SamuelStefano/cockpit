import { describe, it, expect } from 'vitest';
import { createSelfUpdater, isSupervised, type ExecResult } from './self-update';
import { npmBesideNode } from './self-update-boot';

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

interface Repo {
  branch?: string; hooksPath?: string; status?: string; fetchOk?: boolean;
  head?: string; remote?: string; ancestor?: boolean; depsChanged?: boolean;
  mergeOk?: boolean; npmResults?: boolean[];
}

function harness(repo: Repo = {}, opts: { env?: NodeJS.ProcessEnv; busy?: () => boolean; maxWaitMs?: number; bad?: string[]; unconfirmed?: boolean } = {}) {
  const bad = new Set(opts.bad ?? []);
  const pending: Array<[string, string]> = [];
  const calls: string[] = [];
  const logs: string[] = [];
  let restarts = 0;
  let clock = 0;
  const npmResults = [...(repo.npmResults ?? [])];
  const r = (ok: boolean, stdout = ''): ExecResult => ({ ok, stdout, stderr: ok ? '' : 'boom' });
  const exec = async (cmd: string, args: string[]): Promise<ExecResult> => {
    const a = args.filter((x, i) => x !== '-c' && args[i - 1] !== '-c');
    calls.push(`${cmd} ${a.join(' ')}`);
    if (cmd !== 'git') return r(npmResults.shift() ?? true);
    switch (a[0]) {
      case 'rev-parse':
        if (a[1] === '--abbrev-ref') return r(true, `${repo.branch ?? 'main'}\n`);
        return r(true, `${a[1] === 'HEAD' ? repo.head ?? OLD : repo.remote ?? NEW}\n`);
      case 'config': return repo.hooksPath ? r(true, `${repo.hooksPath}\n`) : r(false);
      case 'status': return r(true, repo.status ?? '');
      case 'fetch': return r(repo.fetchOk ?? true);
      case 'merge-base': return r(repo.ancestor ?? true);
      case 'diff': return r(true, repo.depsChanged ? 'package-lock.json\n' : '');
      case 'merge': return r(repo.mergeOk ?? true);
      default: return r(true);
    }
  };
  const updater = createSelfUpdater({
    exec, now: () => clock, busy: opts.busy ?? (() => false), restart: () => { restarts++; }, log: (m) => logs.push(m),
    isBad: (s) => bad.has(s), markBad: (s) => { bad.add(s); },
    markPending: (from, to) => { pending.push([from, to]); }, unconfirmed: () => !!opts.unconfirmed,
  }, { env: opts.env ?? { INVOCATION_ID: 'x' }, maxWaitMs: opts.maxWaitMs ?? 1000 });
  return { updater, calls, logs, bad, pending, restarts: () => restarts, advance: (ms: number) => { clock += ms; } };
}

describe('self-update decision', () => {
  it('fast-forwards and restarts when origin/main is ahead', async () => {
    const h = harness();
    expect(await h.updater.tick()).toBe('restarting');
    expect(h.calls).toContain(`git merge --ff-only -q ${NEW}`);
    expect(h.calls.some((c) => c.startsWith('npm'))).toBe(false);
    expect(h.restarts()).toBe(1);
    expect(h.logs).toContain('[agent] self-update: aaaaaaa..bbbbbbb, restarting');
    expect(h.pending).toEqual([[OLD, NEW]]);
  });

  it('runs git with hooks and fsmonitor disabled', async () => {
    const seen: string[][] = [];
    const u = createSelfUpdater({
      exec: async (cmd, args) => { if (cmd === 'git') seen.push(args); return { ok: true, stdout: args.includes('--abbrev-ref') ? 'main' : '', stderr: '' }; },
      now: () => 0, busy: () => false, restart: () => {}, log: () => {},
      isBad: () => false, markBad: () => {}, markPending: () => {}, unconfirmed: () => false,
    }, { env: { INVOCATION_ID: 'x' } });
    await u.tick();
    const fetch = seen.find((a) => a.includes('fetch'))!;
    expect(fetch.slice(0, 4)).toEqual(['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false']);
  });

  it('does nothing when already current', async () => {
    const h = harness({ remote: OLD });
    expect(await h.updater.tick()).toBe('current');
    expect(h.calls.some((c) => c.includes('merge --ff-only'))).toBe(false);
    expect(h.restarts()).toBe(0);
  });

  it('never moves a checkout that is not behind origin/main', async () => {
    const h = harness({ ancestor: false });
    expect(await h.updater.tick()).toBe('diverged');
    expect(h.calls.some((c) => c.includes('merge --ff-only'))).toBe(false);
  });

  it('is off with DECK_SELF_UPDATE=off and touches nothing', async () => {
    const h = harness({}, { env: { INVOCATION_ID: 'x', DECK_SELF_UPDATE: 'off' } });
    expect(await h.updater.tick()).toBe('disabled');
    expect(h.calls).toEqual([]);
  });

  it.each([
    ['a feature branch', { branch: 'feat/x' }, 'on branch feat/x, not main'],
    ['a dirty tree', { status: ' M server/agent.ts\n' }, 'working tree has local changes'],
    ['armed auto-redeploy hooks', { hooksPath: 'scripts/git-hooks' }, 'core.hooksPath set (auto-redeploy hooks own updates)'],
  ])('skips %s without fetching, logging the reason once', async (_n, repo, why) => {
    const h = harness(repo as Repo);
    expect(await h.updater.tick()).toBe('skipped');
    expect(await h.updater.tick()).toBe('skipped');
    expect(h.calls.some((c) => c.includes('fetch'))).toBe(false);
    expect(h.logs).toEqual([`[agent] self-update: skipped (${why})`]);
  });

  it('ignores untracked files when checking the tree', async () => {
    const h = harness();
    await h.updater.tick();
    expect(h.calls).toContain('git status --porcelain --untracked-files=no');
  });

  it('skips when nothing would bring the process back', async () => {
    const h = harness({}, { env: {} });
    expect(await h.updater.tick()).toBe('skipped');
    expect(h.calls).toEqual([]);
    expect(isSupervised({ DECK_SUPERVISED: '1' })).toBe(true);
    expect(isSupervised({ INVOCATION_ID: 'abc' })).toBe(true);
  });

  it('stays put when the fetch fails', async () => {
    const h = harness({ fetchOk: false });
    expect(await h.updater.tick()).toBe('fetch-failed');
    expect(h.restarts()).toBe(0);
  });

  it('runs npm ci (never npm install) when dependencies changed', async () => {
    const h = harness({ depsChanged: true });
    expect(await h.updater.tick()).toBe('restarting');
    expect(h.calls.filter((c) => c.startsWith('npm'))).toEqual(['npm ci --no-audit --no-fund']);
  });

  it('rolls back to the old commit and dependencies when npm ci fails, and does not retry that commit', async () => {
    const h = harness({ depsChanged: true, npmResults: [false, true] });
    expect(await h.updater.tick()).toBe('rolled-back');
    expect(h.calls).toContain(`git reset -q --hard ${OLD}`);
    expect(h.calls.filter((c) => c.startsWith('npm'))).toHaveLength(2);
    expect(h.restarts()).toBe(0);
    expect(h.logs.some((l) => l.includes('npm ci failed') && l.includes('rolling back'))).toBe(true);
    expect(h.bad.has(NEW)).toBe(true);
    expect(h.pending).toEqual([]);
    expect(await h.updater.tick()).toBe('known-bad');
    expect(h.calls.filter((c) => c.includes('merge --ff-only'))).toHaveLength(1);
  });

  it('never retries a commit that was rolled back on an earlier boot', async () => {
    const h = harness({}, { bad: [NEW] });
    expect(await h.updater.tick()).toBe('known-bad');
    expect(h.calls.some((c) => c.includes('merge --ff-only'))).toBe(false);
  });

  it('waits for the last update to confirm itself before taking another', async () => {
    const h = harness({}, { unconfirmed: true });
    expect(await h.updater.tick()).toBe('skipped');
    expect(h.calls.some((c) => c.includes('fetch'))).toBe(false);
    expect(h.logs).toEqual(['[agent] self-update: skipped (previous update not confirmed yet)']);
  });

  it('does not restart when the fast-forward fails', async () => {
    const h = harness({ mergeOk: false });
    expect(await h.updater.tick()).toBe('merge-failed');
    expect(h.restarts()).toBe(0);
  });

  it('waits for running turns before touching the checkout', async () => {
    let busy = true;
    const h = harness({}, { busy: () => busy });
    expect(await h.updater.tick()).toBe('waiting');
    expect(h.calls.some((c) => c.includes('merge --ff-only'))).toBe(false);
    busy = false;
    expect(await h.updater.tick()).toBe('restarting');
    expect(h.restarts()).toBe(1);
  });

  it('restarts anyway once the max wait is over', async () => {
    const h = harness({}, { busy: () => true, maxWaitMs: 1000 });
    expect(await h.updater.tick()).toBe('waiting');
    h.advance(999);
    expect(await h.updater.tick()).toBe('waiting');
    h.advance(1);
    expect(await h.updater.tick()).toBe('restarting');
    expect(h.restarts()).toBe(1);
  });

  it('restarts only once', async () => {
    const h = harness();
    await h.updater.tick();
    expect(await h.updater.tick()).toBe('restarting');
    expect(h.restarts()).toBe(1);
  });

  it('finds npm next to node, else falls back to PATH', () => {
    expect(npmBesideNode('/nonexistent/bin/node')).toBe('npm');
  });
});
