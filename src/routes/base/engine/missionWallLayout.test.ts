import { describe, expect, it } from 'vitest';
import type { Mission } from '../missions';
import { IDLE_KEY, layoutWall, MAX_SLOTS, MORE_KEY, pickVisible, slotCenter, wrapTitle } from './missionWallLayout';

const mk = (i: number, suggested = false): Mission => ({ id: `m${i}`, title: `Mission ${i}`, summary: '', why: '', description: '', size: 'S', status: 'todo', xp: 10, suggested, reason: '' });
const list = (n: number, suggestedAt = -1) => Array.from({ length: n }, (_, i) => mk(i, i === suggestedAt));
const measure = (s: string) => s.length * 10;

describe('slotCenter', () => {
  it('places slot 0 top-left and fills rows left to right', () => {
    const a = slotCenter(0), b = slotCenter(1), c = slotCenter(6);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBe(a.y);
    expect(c.x).toBe(a.x);
    expect(c.y).toBeLessThan(a.y);
  });
  it('never repeats a position', () => {
    const seen = new Set(Array.from({ length: MAX_SLOTS }, (_, i) => { const p = slotCenter(i); return `${p.x},${p.y}`; }));
    expect(seen.size).toBe(MAX_SLOTS);
  });
});

describe('pickVisible', () => {
  it('shows everything up to the slot cap', () => {
    expect(pickVisible(list(MAX_SLOTS))).toMatchObject({ more: 0 });
    expect(pickVisible(list(MAX_SLOTS)).shown).toHaveLength(MAX_SLOTS);
  });
  it('reserves one slot for the more tile when it overflows', () => {
    const r = pickVisible(list(20));
    expect(r.shown).toHaveLength(MAX_SLOTS - 1);
    expect(r.more).toBe(20 - (MAX_SLOTS - 1));
  });
  it('pulls a hidden suggested mission into view', () => {
    const r = pickVisible(list(20, 18));
    expect(r.shown.some((m) => m.id === 'm18')).toBe(true);
  });
});

describe('layoutWall', () => {
  it('draws one idle screen when empty', () => {
    const w = layoutWall([]);
    expect(w).toHaveLength(1);
    expect(w[0].key).toBe(IDLE_KEY);
  });
  it('appends a more tile that counts the hidden missions', () => {
    const w = layoutWall(list(15));
    const last = w[w.length - 1];
    expect(w).toHaveLength(MAX_SLOTS);
    expect(last).toMatchObject({ key: MORE_KEY, kind: 'more', count: 15 - (MAX_SLOTS - 1) });
  });
  it('has unique keys', () => {
    const keys = layoutWall(list(15)).map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('wrapTitle', () => {
  it('keeps a short title on one line', () => {
    expect(wrapTitle(measure, 'Fix login', 200)).toEqual(['Fix login']);
  });
  it('wraps to two lines', () => {
    expect(wrapTitle(measure, 'Fix the login redirect bug', 150)).toEqual(['Fix the login', 'redirect bug']);
  });
  it('adds an ellipsis when more than two lines are needed', () => {
    const lines = wrapTitle(measure, 'one two three four five six seven eight nine ten', 100);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(100);
  });
  it('splits a single word wider than the line', () => {
    const lines = wrapTitle(measure, 'Supercalifragilisticexpialidocious', 100);
    expect(lines.every((l) => measure(l) <= 100)).toBe(true);
  });
  it('returns nothing for blank text', () => {
    expect(wrapTitle(measure, '   ', 100)).toEqual([]);
  });
});
