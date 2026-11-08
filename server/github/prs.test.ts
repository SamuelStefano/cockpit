import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./pr-sessions', () => ({ indexPrSessions: vi.fn(async () => new Map<string, string>()) }));

import { getPrsSnapshot, ghError, mergePr, setGhForTest } from './prs';

const URL_ = 'https://github.com/SamuelStefano/cockpit/pull/7';

function detail(over: Record<string, unknown> = {}) {
  return JSON.stringify({ data: { resource: {
    url: URL_, number: 7, title: 't', state: 'OPEN', isDraft: false, additions: 1, deletions: 1, changedFiles: 1,
    mergeable: 'MERGEABLE', author: { login: 'SamuelStefano' }, repository: { nameWithOwner: 'SamuelStefano/cockpit' },
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
    files: { totalCount: 1, nodes: [{ path: 'src/a.ts', additions: 1, deletions: 1, changeType: 'MODIFIED' }] },
    ...over,
  } } });
}

function fakeGh(detailJson: string) {
  const calls: string[][] = [];
  setGhForTest(async (args) => {
    calls.push(args);
    if (args[0] === 'api' && args[1] === 'user') return 'samuelstefano\n';
    if (args[0] === 'api' && args[1] === 'graphql') return detailJson;
    if (args[0] === 'pr' && args[1] === 'merge') return '';
    throw new Error(`unexpected ${args.join(' ')}`);
  });
  return calls;
}

const merges = (calls: string[][]) => calls.filter((a) => a[0] === 'pr' && a[1] === 'merge');

describe('mergePr gate', () => {
  afterEach(() => setGhForTest(null));

  it('merges a safe own PR with squash and branch delete', async () => {
    const calls = fakeGh(detail());
    expect(await mergePr(URL_, undefined)).toEqual({ ok: true, message: '#7 mergeada' });
    expect(merges(calls)).toEqual([['pr', 'merge', URL_, '--squash', '--delete-branch']]);
  });

  it('refuses an unsafe PR without the typed ref, merges with it', async () => {
    const unsafe = detail({ files: { totalCount: 1, nodes: [{ path: 'supabase/migrations/1.sql', additions: 1, deletions: 0, changeType: 'ADDED' }] } });
    let calls = fakeGh(unsafe);
    const r = await mergePr(URL_, 'yes');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/cockpit#7/);
    expect(merges(calls)).toEqual([]);
    calls = fakeGh(unsafe);
    expect((await mergePr(URL_, 'cockpit#7')).ok).toBe(true);
    expect(merges(calls)).toHaveLength(1);
  });

  it('never merges someone else\'s PR', async () => {
    const calls = fakeGh(detail({ author: { login: 'taigfs' } }));
    expect(await mergePr(URL_, 'cockpit#7')).toEqual({ ok: false, message: 'PR de outra pessoa — revise, não mergeie' });
    expect(merges(calls)).toEqual([]);
  });

  it('refuses a conflict and a non-PR URL', async () => {
    const calls = fakeGh(detail({ mergeable: 'CONFLICTING' }));
    expect((await mergePr(URL_, undefined)).message).toMatch(/conflito/);
    expect((await mergePr('https://evil.example/pull/1', undefined)).message).toBe('URL de PR inválida');
    expect(merges(calls)).toEqual([]);
  });
});

describe('getPrsSnapshot', () => {
  beforeEach(() => setGhForTest(null));
  afterEach(() => setGhForTest(null));

  it('keeps the last good lists when a refresh fails', async () => {
    const page = JSON.stringify({ data: { search: { pageInfo: { hasNextPage: false }, nodes: [{ url: 'https://github.com/a/b/pull/1', number: 1, state: 'OPEN', repository: { nameWithOwner: 'a/b' } }] } } });
    let fail = false;
    setGhForTest(async () => {
      if (fail) throw Object.assign(new Error('x'), { stderr: 'To get started with GitHub CLI, please run:  gh auth login' });
      return page;
    });
    const first = await getPrsSnapshot(true);
    expect(first.mine).toHaveLength(1);
    expect(first.error).toBeUndefined();
    fail = true;
    const failed = await getPrsSnapshot(true);
    expect(failed.mine).toHaveLength(1);
    expect(failed.error).toMatch(/gh auth login/);
  });

  it('a first failure shows the error with empty lists', async () => {
    setGhForTest(async () => { throw Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' }); });
    const s = await getPrsSnapshot(true);
    expect(s).toMatchObject({ mine: [], merged: [], review: [], error: 'gh não está instalado nesta máquina' });
  });

  it('serves the cache inside the TTL', async () => {
    let n = 0;
    setGhForTest(async () => { n++; return JSON.stringify({ data: { search: { pageInfo: {}, nodes: [] } } }); });
    const a = await getPrsSnapshot(true);
    const b = await getPrsSnapshot(false, a.fetchedAt + 1000);
    expect(b).toBe(a);
    expect(n).toBe(3);
  });
});

describe('ghError', () => {
  it('explains a missing or logged-out gh', () => {
    expect(ghError(Object.assign(new Error('spawn gh ENOENT'), { code: 'ENOENT' }))).toMatch(/instalado/);
    expect(ghError({ stderr: 'HTTP 401: Bad credentials' })).toMatch(/logado/);
    expect(ghError({ stderr: 'warn\nGraphQL: Pull request is not mergeable\n' })).toBe('GraphQL: Pull request is not mergeable');
  });
});
