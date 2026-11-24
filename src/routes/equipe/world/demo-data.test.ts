import { describe, it, expect } from 'vitest';
import { demoMergedCounts } from './demo-data';
import { mergedDiff } from './world-celebrate';

describe('demoMergedCounts', () => {
  it('celebrates one bot every other tick', () => {
    expect(mergedDiff(demoMergedCounts(0), demoMergedCounts(1))).toEqual([]);
    expect(mergedDiff(demoMergedCounts(1), demoMergedCounts(2))).toHaveLength(1);
    expect(mergedDiff(demoMergedCounts(2), demoMergedCounts(3))).toEqual([]);
    expect(mergedDiff(demoMergedCounts(3), demoMergedCounts(4))).toHaveLength(1);
  });
});
