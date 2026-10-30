import { describe, expect, it } from 'vitest';
import { layoutWings, MAX_COLS, OTHER_WING_ID, sectorRows, slotPosition } from './sectors';

describe('layoutWings', () => {
  it('keeps the given order and packs columns', () => {
    const { wings } = layoutWings([{ id: 'a', name: 'A', count: 3 }, { id: 'b', name: 'B', count: 1 }]);
    expect(wings.map((w) => [w.id, w.colStart, w.cols])).toEqual([['a', 0, 2], ['b', 2, 1]]);
  });
  it('folds the smallest wings when 18 single-agent projects overflow the floor', () => {
    const groups = Array.from({ length: 18 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, count: 1 }));
    const { wings, folded } = layoutWings(groups);
    expect(wings.reduce((n, w) => n + w.cols, 0)).toBeLessThanOrEqual(MAX_COLS);
    expect(wings.reduce((n, w) => n + w.count, 0)).toBe(18);
    expect(Object.values(folded).every((v) => v === OTHER_WING_ID)).toBe(true);
  });
});

describe('slotPosition', () => {
  it('gives every slot of a wing its own desk', () => {
    const seen = new Set([0, 1, 2, 3].map((s) => { const p = slotPosition({ colStart: 1 }, s); return `${p.x},${p.z}`; }));
    expect(seen.size).toBe(4);
  });
});

describe('sectorRows', () => {
  it('counts busy, stuck and waiting per sector', () => {
    const rows = sectorRows([{ sector: 'build', state: 'working' }, { sector: 'build', state: 'blocked' }, { sector: 'intake', state: 'waiting' }], { ship: { busy: 2 } });
    expect(rows.find((r) => r.id === 'build')).toMatchObject({ busy: 1, stuck: 1, waiting: 0 });
    expect(rows.find((r) => r.id === 'intake')).toMatchObject({ waiting: 1 });
    expect(rows.find((r) => r.id === 'ship')).toMatchObject({ busy: 2 });
  });
});
