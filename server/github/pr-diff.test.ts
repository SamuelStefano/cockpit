import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./pr-sessions', () => ({ indexPrSessions: vi.fn(async () => new Map<string, string>()), peekPrSessions: () => new Map<string, string>() }));

import { clearPrDiffCache, getPrDiff } from './pr-diff';
import { setGhForTest } from './prs';

const URL_ = 'https://github.com/a/b/pull/5';
const row = (i: number) => ({ filename: `f${i}.ts`, status: 'modified', additions: 1, deletions: 0, patch: '@@ +1' });

describe('getPrDiff', () => {
  beforeEach(() => clearPrDiffCache());
  afterEach(() => setGhForTest(null));

  it('rejects a non-PR url without calling gh', async () => {
    const gh = vi.fn(async () => '[]');
    setGhForTest(gh);
    expect(await getPrDiff('https://evil.example/x')).toEqual({ diff: null, error: 'URL de PR inválida' });
    expect(gh).not.toHaveBeenCalled();
  });

  it('pages until a short page, and caches inside the TTL', async () => {
    const calls: string[] = [];
    setGhForTest(async (args) => {
      calls.push(args[1]);
      return JSON.stringify(args[1].endsWith('&page=1') ? Array.from({ length: 100 }, (_, i) => row(i)) : [row(100)]);
    });
    const r = await getPrDiff(URL_);
    expect(r.diff).toMatchObject({ url: URL_, totalFiles: 101, truncated: false });
    expect(calls).toEqual(['repos/a/b/pulls/5/files?per_page=100&page=1', 'repos/a/b/pulls/5/files?per_page=100&page=2']);
    await getPrDiff(URL_);
    expect(calls).toHaveLength(2);
  });

  it('flags truncation at the 3-page cap and single-flights concurrent calls', async () => {
    let n = 0;
    setGhForTest(async () => { n++; return JSON.stringify(Array.from({ length: 100 }, (_, i) => row(i))); });
    const [a, b] = await Promise.all([getPrDiff(URL_), getPrDiff(URL_)]);
    expect(a.diff?.truncated).toBe(true);
    expect(a.diff?.files).toHaveLength(300);
    expect(b.diff).toBe(a.diff);
    expect(n).toBe(3);
  });

  it('turns a gh failure into an error', async () => {
    setGhForTest(async () => { throw Object.assign(new Error('x'), { stderr: 'HTTP 404: Not Found' }); });
    const r = await getPrDiff(URL_);
    expect(r.diff).toBeNull();
    expect(r.error).toMatch(/404/);
  });
});
