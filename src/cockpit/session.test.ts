// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { newId, metaToSession, dedupById, mergeSeen } from './session';

describe('newId', () => {
  it('keeps the given prefix', () => {
    expect(newId('term-').startsWith('term-')).toBe(true);
  });

  it('returns distinct ids even within the same tick', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId('s')));
    expect(ids.size).toBe(1000);
  });
});

describe('metaToSession', () => {
  it('maps meta fields and stamps active + hasTerminal default', () => {
    const meta = { id: 's1', title: 'T', relative: '2m', snippet: 'hi', mtime: 42, count: 3 };
    expect(metaToSession(meta, true)).toEqual({
      id: 's1', title: 'T', relative: '2m', snippet: 'hi', mtime: 42, hasTerminal: false, active: true,
    });
  });
});

describe('dedupById', () => {
  it('keeps the first occurrence and drops later duplicates', () => {
    const rows = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 }];
    expect(dedupById(rows)).toEqual([{ id: 'a', n: 1 }, { id: 'b', n: 2 }]);
  });
  it('returns an empty array unchanged', () => {
    expect(dedupById([])).toEqual([]);
  });
});

describe('mergeSeen', () => {
  it('baselines a brand-new id to its mtime and flags changed', () => {
    const { next, changed } = mergeSeen({}, [{ id: 'a', mtime: 10 }]);
    expect(next).toEqual({ a: 10 });
    expect(changed).toBe(true);
  });
  it('preserves an existing baseline instead of re-stamping mtime', () => {
    const { next, changed } = mergeSeen({ a: 5 }, [{ id: 'a', mtime: 99 }]);
    expect(next).toEqual({ a: 5 });
    expect(changed).toBe(false);
  });
  it('prunes ids no longer in the list and flags changed', () => {
    const { next, changed } = mergeSeen({ a: 5, gone: 1 }, [{ id: 'a', mtime: 5 }]);
    expect(next).toEqual({ a: 5 });
    expect(changed).toBe(true);
  });
  it('preserves local new- ids that the server does not know yet', () => {
    const { next, changed } = mergeSeen({ 'new-x': 7 }, [{ id: 'a', mtime: 5 }]);
    expect(next).toEqual({ 'new-x': 7, a: 5 });
    expect(changed).toBe(true);
  });
});
