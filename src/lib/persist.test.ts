// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPref, savePref } from './persist';

describe('loadPref / savePref', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a value through the namespaced key', () => {
    savePref('width', 320);
    expect(loadPref('width', 0)).toBe(320);
    expect(localStorage.getItem('cockpit:width')).toBe('320');
  });

  it('round-trips structured values', () => {
    savePref('pinned', ['a', 'b']);
    expect(loadPref<string[]>('pinned', [])).toEqual(['a', 'b']);
  });

  it('returns the fallback when the key is absent', () => {
    expect(loadPref('missing', 'def')).toBe('def');
  });

  it('returns the fallback when the stored JSON is corrupt', () => {
    localStorage.setItem('cockpit:bad', '{not json');
    expect(loadPref('bad', 42)).toBe(42);
  });

  it('treats a stored null as a present value, not a fallback trigger', () => {
    savePref('explicit', null);
    expect(loadPref('explicit', 'fb')).toBeNull();
  });
});
