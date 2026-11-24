import { describe, it, expect } from 'vitest';
import { assignVariants, chibiFrame, hashId, idleAnim, shirtTint, walkAnim } from './world-chibi';

describe('chibiFrame', () => {
  it('indexes variant, direction and animation', () => {
    expect(chibiFrame(0, 'left', 0)).toBe(0);
    expect(chibiFrame(0, 'down', 0)).toBe(6);
    expect(chibiFrame(0, 'up', 3)).toBe(15);
    expect(chibiFrame(0, 'right', 5)).toBe(23);
    expect(chibiFrame(7, 'right', 5)).toBe(7 * 24 + 23);
  });
});

describe('animation clocks', () => {
  it('cycles the walk frames 2-3-4-5 every 130 ms', () => {
    expect([0, 130, 260, 390, 520].map(walkAnim)).toEqual([2, 3, 4, 5, 2]);
  });
  it('alternates idle and stretch every 600 ms', () => {
    expect([0, 599, 600, 1200].map(idleAnim)).toEqual([0, 0, 1, 0]);
  });
});

describe('shirtTint', () => {
  it('accepts strict hex and rejects everything else', () => {
    expect(shirtTint('#3fd17f')).toBe(0x3fd17f);
    expect(shirtTint('red')).toBe(shirtTint(undefined));
    expect(shirtTint('#3fd17f; x')).toBe(shirtTint(undefined));
  });
});

describe('assignVariants', () => {
  const ids = Array.from({ length: 24 }, (_, i) => `bot-${i}`);
  const spots = ids.map((id, i) => ({ id, station: i < 12 ? 'escritorio' : i < 18 ? 'sala' : 'plaza' }));

  it('is deterministic and in range', () => {
    const a = assignVariants(spots);
    expect([...assignVariants(spots)]).toEqual([...a]);
    for (const v of a.values()) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(8); }
  });

  it('never gives neighbours at one station the same variant', () => {
    const a = assignVariants(spots);
    for (let i = 1; i < spots.length; i++) if (spots[i]!.station === spots[i - 1]!.station) expect(a.get(spots[i]!.id)).not.toBe(a.get(spots[i - 1]!.id));
    const sala = spots.filter((s) => s.station === 'sala');
    expect(a.get(sala[0]!.id)).not.toBe(a.get(sala[sala.length - 1]!.id));
  });

  it('separates a worst case where every id hashes alike', () => {
    const same = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, station: 's' }));
    const prev = new Map(same.map((s) => [s.id, 3]));
    const a = assignVariants(same, prev);
    for (let i = 1; i < same.length; i++) expect(a.get(same[i]!.id)).not.toBe(a.get(same[i - 1]!.id));
  });

  it('keeps a bot variant when others come and go', () => {
    const first = assignVariants(spots);
    const without = spots.filter((s) => s.id !== 'bot-5');
    const again = assignVariants(without, first);
    const changed = without.filter((s) => again.get(s.id) !== first.get(s.id));
    expect(changed.length).toBeLessThanOrEqual(1);
  });

  it('hashes ids stably', () => {
    expect(hashId('iris')).toBe(hashId('iris'));
    expect(hashId('iris')).not.toBe(hashId('otto'));
  });
});
