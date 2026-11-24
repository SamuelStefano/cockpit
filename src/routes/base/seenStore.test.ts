// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNewSince, markSeen, readSeen, SEEN_CAP, withSeen } from './seenStore';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('withSeen', () => {
  it('caps at 200 entries and drops the oldest marks', () => {
    let m = {};
    for (let i = 0; i < SEEN_CAP + 5; i++) m = withSeen(m, `s${i}`, 1000 + i);
    expect(Object.keys(m)).toHaveLength(SEEN_CAP);
    expect('s0' in m).toBe(false);
    expect('s4' in m).toBe(false);
    expect('s5' in m).toBe(true);
  });
  it('never moves a mark backwards or drops the session just written', () => {
    expect(withSeen({ a: 50 }, 'a', 10).a).toBe(50);
    const m = withSeen({ a: 5, b: 6 }, 'old', 1, 2);
    expect(m.old).toBe(1);
    expect(Object.keys(m)).toHaveLength(2);
  });
});

describe('isNewSince', () => {
  it('marks only rows with a timestamp newer than a known mark', () => {
    expect(isNewSince(100, 101)).toBe(true);
    expect(isNewSince(100, 100)).toBe(false);
    expect(isNewSince(100, undefined)).toBe(false);
    expect(isNewSince(undefined, 101)).toBe(false);
  });
});

describe('storage', () => {
  it('round-trips and ignores garbage', () => {
    markSeen('s1', 10);
    expect(readSeen()).toEqual({ s1: 10 });
    localStorage.setItem('deck-base-seen', '[1,2]');
    expect(readSeen()).toEqual({});
  });
  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('private'); });
    expect(() => markSeen('s1', 1)).not.toThrow();
    expect(readSeen()).toEqual({});
  });
});
