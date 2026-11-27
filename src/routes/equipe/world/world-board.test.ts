import { describe, it, expect } from 'vitest';
import { advance, doingEdges, hangPlaque, isCarrying, newErrand, plaquePos, stepOf, taskboxFrame, type Plaque } from './world-board';

describe('doingEdges', () => {
  it('reports only flips and ignores first sight', () => {
    const first = doingEdges(new Map(), [{ id: 'a', doing: true }, { id: 'b' }]);
    expect(first.started).toEqual([]);
    expect(first.stopped).toEqual([]);
    const up = doingEdges(first.next, [{ id: 'a', doing: true }, { id: 'b', doing: true }]);
    expect(up.started).toEqual(['b']);
    const down = doingEdges(up.next, [{ id: 'a' }, { id: 'b', doing: true }]);
    expect(down.stopped).toEqual(['a']);
    expect(down.started).toEqual([]);
  });

  it('forgets bots that left', () => {
    const r = doingEdges(new Map([['gone', true]]), [{ id: 'a' }]);
    expect([...r.next.keys()]).toEqual(['a']);
  });
});

describe('errand', () => {
  it('walks the start steps and carries only on the way to the desk', () => {
    const seen: string[] = [];
    const carry: boolean[] = [];
    for (let e = newErrand('start') as ReturnType<typeof newErrand> | null; e; e = advance(e)) { seen.push(stepOf(e)); carry.push(isCarrying(e)); }
    expect(seen).toEqual(['goBoard', 'pickup', 'goDesk', 'setdown']);
    expect(carry).toEqual([false, false, true, false]);
  });

  it('walks the finish steps', () => {
    const seen: string[] = [];
    for (let e = newErrand('finish') as ReturnType<typeof newErrand> | null; e; e = advance(e)) seen.push(stepOf(e));
    expect(seen).toEqual(['goBoard', 'hang', 'goHome']);
  });
});

describe('hangPlaque', () => {
  it('fills hooks 0, 1, 2 in order', () => {
    let list: Plaque[] = [];
    const hooks: number[] = [];
    for (let i = 0; i < 3; i++) { const r = hangPlaque(list, i); list = r.list; hooks.push(r.hook); expect(r.removed).toBeNull(); }
    expect(hooks).toEqual([0, 1, 2]);
  });

  it('replaces the oldest when full and never shows more than 3', () => {
    let list: Plaque[] = [];
    for (let i = 0; i < 3; i++) list = hangPlaque(list, i).list;
    const r = hangPlaque(list, 3);
    expect(r.removed).toEqual({ hook: 0, serial: 0 });
    expect(r.hook).toBe(0);
    expect(r.list).toHaveLength(3);
    expect(hangPlaque(r.list, 4).removed?.serial).toBe(1);
  });

  it('reuses a freed hook before replacing', () => {
    const r = hangPlaque([{ hook: 0, serial: 0 }, { hook: 2, serial: 1 }], 2);
    expect(r.hook).toBe(1);
    expect(r.removed).toBeNull();
  });
});

describe('frames and positions', () => {
  it('maps facings to taskbox frames', () => {
    expect([taskboxFrame('left'), taskboxFrame('down'), taskboxFrame('up'), taskboxFrame('right')]).toEqual([0, 1, 2, 3]);
  });

  it('puts plaques on the three hooks', () => {
    expect([0, 1, 2].map((h) => plaquePos(100, 200, h).x)).toEqual([110, 123, 136]);
  });
});
