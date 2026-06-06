// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { newId, metaToSession } from './session';

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
