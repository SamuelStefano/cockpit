import { describe, it, expect } from 'vitest';
import { resolveKey, moveKey } from './migrate';

describe('resolveKey', () => {
  it('returns the key unchanged when not migrated', () => {
    expect(resolveKey({}, 'new-abc')).toBe('new-abc');
    expect(resolveKey({ 'new-x': 'uuid-1' }, 'new-y')).toBe('new-y');
  });

  it('redirects a migrated key to its real id', () => {
    expect(resolveKey({ 'new-abc': 'uuid-1' }, 'new-abc')).toBe('uuid-1');
  });

  it('leaves the real id alone (idempotent after migration)', () => {
    expect(resolveKey({ 'new-abc': 'uuid-1' }, 'uuid-1')).toBe('uuid-1');
  });
});

describe('moveKey', () => {
  it('returns the same reference when oldKey is absent', () => {
    const rec = { 'uuid-1': 5 };
    expect(moveKey(rec, 'new-abc', 'uuid-1')).toBe(rec);
  });

  it('renames oldKey to newKey', () => {
    const rec = { 'new-abc': 7, other: 1 };
    const out = moveKey(rec, 'new-abc', 'uuid-1');
    expect(out).toEqual({ 'uuid-1': 7, other: 1 });
    expect('new-abc' in out).toBe(false);
  });

  it('does not mutate the input', () => {
    const rec = { 'new-abc': 7 };
    moveKey(rec, 'new-abc', 'uuid-1');
    expect(rec).toEqual({ 'new-abc': 7 });
  });

  it('lets the in-flight value win over an existing newKey entry', () => {
    const rec = { 'new-abc': 7, 'uuid-1': 99 };
    const out = moveKey(rec, 'new-abc', 'uuid-1');
    expect(out['uuid-1']).toBe(7);
    expect('new-abc' in out).toBe(false);
  });
});
