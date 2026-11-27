import { describe, it, expect } from 'vitest';
import { demoDoing, demoMergedCounts, demoTeamState } from './demo-data';
import { mergedDiff } from './world-celebrate';

describe('demoMergedCounts', () => {
  it('celebrates one bot every other tick', () => {
    expect(mergedDiff(demoMergedCounts(0), demoMergedCounts(1))).toEqual([]);
    expect(mergedDiff(demoMergedCounts(1), demoMergedCounts(2))).toHaveLength(1);
    expect(mergedDiff(demoMergedCounts(2), demoMergedCounts(3))).toEqual([]);
    expect(mergedDiff(demoMergedCounts(3), demoMergedCounts(4))).toHaveLength(1);
  });
});

describe('demoDoing', () => {
  it('has one bot doing for a window, then none, then the next bot', () => {
    expect([...demoDoing(0)]).toEqual([]);
    expect([...demoDoing(2)]).toEqual(['luffy']);
    expect([...demoDoing(9)]).toEqual(['luffy']);
    expect([...demoDoing(10)]).toEqual([]);
    expect([...demoDoing(18)]).toEqual(['zoro']);
  });

  it('flags the bot in the demo state', () => {
    const doing = demoTeamState(0, 2).bots.filter((b) => b.doing);
    expect(doing.map((b) => b.id)).toEqual(['luffy']);
  });
});
