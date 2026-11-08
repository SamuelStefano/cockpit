import { describe, expect, it } from 'vitest';
import { checkRunFromNode, detailFromResource, orderChecks, prFromNode, searchPage } from './prs-parse';

const node = (over: Record<string, unknown> = {}) => ({
  url: 'https://github.com/iterahq/itera-api/pull/412',
  number: 412,
  title: 'feat: activity kind',
  state: 'OPEN',
  isDraft: false,
  createdAt: '2026-11-06T10:00:00Z',
  updatedAt: '2026-11-07T10:00:00Z',
  mergedAt: null,
  headRefName: 'feat/kind',
  baseRefName: 'main',
  additions: 40,
  deletions: 3,
  changedFiles: 2,
  mergeable: 'CONFLICTING',
  reviewDecision: 'CHANGES_REQUESTED',
  body: 'Task: DFL-831',
  author: { login: 'SamuelStefano' },
  repository: { nameWithOwner: 'iterahq/itera-api' },
  commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
  files: { totalCount: 2, nodes: [{ path: 'supabase/migrations/1.sql' }, { path: 'src/a.ts' }] },
  ...over,
});

describe('prFromNode', () => {
  it('maps a search node into a summary with risk, task and session', () => {
    const pr = prFromNode(node(), new Map([['https://github.com/iterahq/itera-api/pull/412', 'sess-1']]));
    expect(pr).toMatchObject({
      number: 412, repo: 'iterahq/itera-api', state: 'open', checks: 'failure', review: 'changes',
      mergeable: 'conflict', risk: 'unsafe', task: 'DFL-831', sessionId: 'sess-1',
    });
    expect(pr?.mergedAt).toBeUndefined();
  });

  it('merged nodes without files skip the risk class', () => {
    const { files: _files, ...rest } = node({ state: 'MERGED', mergedAt: '2026-11-07T12:00:00Z', commits: { nodes: [] } });
    const pr = prFromNode(rest);
    expect(pr).toMatchObject({ state: 'merged', risk: 'safe', checks: 'none', mergedAt: '2026-11-07T12:00:00Z' });
  });

  it('a truncated file list is at least maybe', () => {
    expect(prFromNode(node({ files: { totalCount: 300, nodes: [{ path: 'src/a.ts' }] } }))?.risk).toBe('maybe');
  });

  it('ignores empty nodes (search hits that are not PRs)', () => {
    expect(prFromNode({})).toBeNull();
    expect(prFromNode(null)).toBeNull();
  });
});

describe('searchPage', () => {
  it('returns the cursor only while there is a next page', () => {
    expect(searchPage({ data: { search: { pageInfo: { hasNextPage: true, endCursor: 'c1' }, nodes: [1] } } })).toEqual({ nodes: [1], next: 'c1' });
    expect(searchPage({ data: { search: { pageInfo: { hasNextPage: false, endCursor: 'c2' }, nodes: [] } } }).next).toBeNull();
    expect(searchPage({ errors: [] })).toEqual({ nodes: [], next: null });
  });
});

describe('checkRunFromNode', () => {
  it('maps check runs and status contexts', () => {
    expect(checkRunFromNode({ __typename: 'CheckRun', name: 'gate', status: 'COMPLETED', conclusion: 'SUCCESS', detailsUrl: 'u' })).toEqual({ name: 'gate', state: 'success', url: 'u' });
    expect(checkRunFromNode({ __typename: 'CheckRun', name: 'smoke', status: 'IN_PROGRESS', conclusion: null })?.state).toBe('pending');
    expect(checkRunFromNode({ __typename: 'CheckRun', name: 'e2e', status: 'COMPLETED', conclusion: 'TIMED_OUT' })?.state).toBe('failure');
    expect(checkRunFromNode({ __typename: 'StatusContext', context: 'vercel', state: 'ERROR', targetUrl: 'v' })).toEqual({ name: 'vercel', state: 'failure', url: 'v' });
    expect(checkRunFromNode({ __typename: 'Other' })).toBeNull();
  });
});

describe('detailFromResource', () => {
  it('builds files, checks and a time-ordered conversation', () => {
    const raw = { data: { resource: {
      ...node({ files: { totalCount: 1, nodes: [{ path: 'src/a.ts', additions: 4, deletions: 1, changeType: 'ADDED' }] } }),
      checks: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [{ __typename: 'CheckRun', name: 'gate', status: 'COMPLETED', conclusion: 'FAILURE' }] } } } }] },
      comments: { nodes: [{ author: { login: 'taigfs' }, body: 'later', createdAt: '2026-11-07T11:00:00Z' }] },
      reviews: { nodes: [
        { author: { login: 'taigfs' }, body: '', state: 'CHANGES_REQUESTED', createdAt: '2026-11-07T09:00:00Z' },
        { author: { login: 'x' }, body: '', state: 'COMMENTED', createdAt: '2026-11-07T09:30:00Z' },
      ] },
    } } };
    const d = detailFromResource(raw);
    expect(d?.files).toEqual([{ path: 'src/a.ts', additions: 4, deletions: 1, change: 'added' }]);
    expect(d?.filesTruncated).toBe(false);
    expect(d?.checkRuns).toEqual([{ name: 'gate', state: 'failure', url: undefined }]);
    expect(d?.comments.map((c) => [c.author, c.kind, c.body])).toEqual([['taigfs', 'review', '_pediu mudanças_'], ['taigfs', 'comment', 'later']]);
  });

  it('a missing resource is null', () => {
    expect(detailFromResource({ data: { resource: null } })).toBeNull();
  });
});

describe('orderChecks', () => {
  it('drops repeated name+state rows and puts failures first', () => {
    const runs = [
      { name: 'tier', state: 'skipped' as const }, { name: 'tier', state: 'skipped' as const },
      { name: 'unit', state: 'success' as const }, { name: 'e2e', state: 'failure' as const }, { name: 'lint', state: 'pending' as const },
    ];
    expect(orderChecks(runs).map((r) => `${r.name}:${r.state}`)).toEqual(['e2e:failure', 'lint:pending', 'unit:success', 'tier:skipped']);
  });
});
