import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'session-prs-'));
const file = join(dir, 'sess.jsonl');

vi.mock('./pr-sessions', () => ({ indexPrSessions: vi.fn(async () => new Map<string, string>()), peekPrSessions: () => new Map<string, string>() }));
vi.mock('../sessions/records', () => ({ sessionPath: (id: string) => (id === 'bad' ? null : id === 'missing' ? join(dir, 'nope.jsonl') : file) }));

import { setGhForTest } from './prs';
import { getSessionPrs, urlListsFrom } from './session-prs';

const U = (n: number) => `https://github.com/a/b/pull/${n}`;

describe('urlListsFrom', () => {
  it('dedups created, orders mentions by last appearance and excludes created', () => {
    const links = [
      JSON.stringify({ type: 'pr-link', prUrl: U(1) }), JSON.stringify({ type: 'pr-link', prUrl: U(1) }), JSON.stringify({ type: 'pr-link', prUrl: U(2) }),
      'not json "pr-link"',
    ].join('\n');
    const all = [U(1), U(3), U(4), U(3), U(2)].join('\n');
    expect(urlListsFrom(links, all)).toEqual({ createdUrls: [U(1), U(2)], mentionedUrls: [U(3), U(4)] });
  });

  it('caps mentions at 40', () => {
    const all = Array.from({ length: 60 }, (_, i) => U(i + 1)).join('\n');
    const r = urlListsFrom('', all);
    expect(r.mentionedUrls).toHaveLength(40);
    expect(r.mentionedUrls[0]).toBe(U(60));
  });
});

describe('getSessionPrs', () => {
  afterEach(() => setGhForTest(null));

  it('handles invalid and missing sessions', async () => {
    expect(await getSessionPrs('bad', false)).toEqual({ sessionId: 'bad', createdUrls: [], mentionedUrls: [], error: 'sessão inválida' });
    expect(await getSessionPrs('missing', true)).toEqual({ sessionId: 'missing', createdUrls: [], mentionedUrls: [] });
  });

  it('reads created and mentioned urls from the transcript and hydrates in one request', async () => {
    writeFileSync(file, [
      JSON.stringify({ type: 'pr-link', prUrl: U(1), sessionId: 's' }),
      JSON.stringify({ type: 'user', text: `see ${U(2)}/files#diff and ${U(9)}` }),
      JSON.stringify({ type: 'user', text: `again ${U(2)}` }),
    ].join('\n') + '\n');
    const calls: string[][] = [];
    setGhForTest(async (args) => {
      calls.push(args);
      const mk = (n: number) => ({ url: U(n), number: n, state: 'OPEN', repository: { nameWithOwner: 'a/b' } });
      return JSON.stringify({ data: { p0: mk(1), p1: mk(2), p2: null } });
    });
    const plain = await getSessionPrs('sess', false);
    expect(plain).toEqual({ sessionId: 'sess', createdUrls: [U(1)], mentionedUrls: [U(2), U(9)] });
    expect(calls).toHaveLength(0);
    const r = await getSessionPrs('sess', true);
    expect(r.prs?.map((p) => p.number)).toEqual([1, 2]);
    expect(calls).toHaveLength(1);
    await getSessionPrs('sess', true);
    expect(calls).toHaveLength(1);
  });

  it('keeps the url lists and reports a gh failure', async () => {
    writeFileSync(file, JSON.stringify({ type: 'pr-link', prUrl: U(7) }) + '\n');
    setGhForTest(async () => { throw Object.assign(new Error('x'), { stderr: 'boom' }); });
    const r = await getSessionPrs('sess', true);
    expect(r).toMatchObject({ createdUrls: [U(7)], error: 'boom' });
    expect(r.prs).toBeUndefined();
  });

  it('keeps the PRs gh could read when one in the batch is refused', async () => {
    writeFileSync(file, [JSON.stringify({ type: 'pr-link', prUrl: U(21) }), JSON.stringify({ type: 'pr-link', prUrl: U(22) })].join('\n'));
    const partial = { data: { p0: { url: U(21), number: 21, repository: { nameWithOwner: 'a/b' } }, p1: null }, errors: [{ message: 'SAML' }] };
    setGhForTest(async () => { throw Object.assign(new Error('gh: SAML'), { stdout: JSON.stringify(partial), stderr: 'gh: SAML' }); });
    const r = await getSessionPrs('sess-partial', true);
    expect(r.prs?.map((p) => p.number)).toEqual([21]);
    expect(r.error).toBeUndefined();
  });
});
