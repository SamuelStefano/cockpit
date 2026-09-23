import { describe, expect, it } from 'vitest';
import { seedRunStart } from './run-start';

describe('seedRunStart', () => {
  it('replaces a reload-time stamp with the server start', () => {
    expect(seedRunStart({ a: 9_000 }, { a: 1_000 })).toEqual({ a: 1_000 });
  });

  it('seeds keys the client had no start for', () => {
    expect(seedRunStart({}, { a: 1_000, b: 2_000 })).toEqual({ a: 1_000, b: 2_000 });
  });

  it('maps server keys to the migrated client key', () => {
    expect(seedRunStart({}, { 'new-x': 1_000 }, (k) => (k === 'new-x' ? 'uuid' : k))).toEqual({ uuid: 1_000 });
  });

  it('returns null when nothing changes or nothing came', () => {
    expect(seedRunStart({ a: 1_000 }, { a: 1_000 })).toBeNull();
    expect(seedRunStart({ a: 1_000 }, undefined)).toBeNull();
    expect(seedRunStart({}, { a: 0, b: Number.NaN })).toBeNull();
  });
});
