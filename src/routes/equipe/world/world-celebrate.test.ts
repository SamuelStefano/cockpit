import { describe, it, expect } from 'vitest';
import { mergedDiff } from './world-celebrate';

describe('mergedDiff', () => {
  it('ignores the first snapshot', () => {
    expect(mergedDiff(undefined, { a: 3 })).toEqual([]);
    expect(mergedDiff(null, { a: 3 })).toEqual([]);
  });
  it('lists ids whose count increased', () => {
    expect(mergedDiff({ a: 1, b: 2 }, { a: 2, b: 2, c: 1 })).toEqual(['a', 'c']);
  });
  it('ignores decreases and equal counts', () => {
    expect(mergedDiff({ a: 5 }, { a: 4 })).toEqual([]);
    expect(mergedDiff({ a: 5 }, { a: 5 })).toEqual([]);
  });
  it('treats a new id with zero as no change', () => {
    expect(mergedDiff({}, { a: 0 })).toEqual([]);
  });
});
