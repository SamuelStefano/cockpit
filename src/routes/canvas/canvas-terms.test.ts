import { describe, expect, it } from 'vitest';
import type { CanvasNode } from '../../../shared/canvas';
import {
  autoAdd, capOpen, isWatchTerm, laneSlot, MAX_OPEN_TERMS, newShellId, nudgeToFreeSlot, pickRecentSessions, placeWindows, shellNodes,
  TERM_H, TERM_W, watchTermId, winKey,
} from './canvas-terms';

describe('watchTermId', () => {
  it('fits the tmux name allow-list', () => {
    const id = watchTermId('55b717e4-4e61-4a4f-83f9-2d2a4cdea948');
    expect(id).toBe('w-55b717e44e614a4f83f92d2a');
    expect(id).toMatch(/^[a-zA-Z0-9_-]{1,32}$/);
    expect(isWatchTerm(id)).toBe(true);
  });
});

describe('newShellId', () => {
  it('is a short allow-listed tmux name', () => {
    expect(newShellId(0)).toBe('cv-000000');
    expect(newShellId(0.999999)).toMatch(/^cv-[a-z0-9]{6}$/);
  });
});

describe('shellNodes', () => {
  it('keeps only canvas-born shells, not watchers or the side panel terminals', () => {
    const nodes = shellNodes(['main', 'term-101', 'w-abc', 'cv-2', 'cv-1'], 5);
    expect(nodes.map((n) => n.id)).toEqual(['t:cv-1', 't:cv-2']);
    expect(nodes[0]).toMatchObject({ kind: 'shell', ref: 'cv-1', mtime: 5 });
  });
});

describe('laneSlot', () => {
  const map = { x: 0, y: 1000, w: 5000, h: 3000 };

  it('opens above the map', () => {
    expect(laneSlot(map, [])).toEqual({ x: 0, y: 1000 - TERM_H - 160 });
  });

  it('skips slots already covered by an open window', () => {
    const first = laneSlot(map, []);
    const second = laneSlot(map, [{ ...first, w: TERM_W, h: TERM_H }]);
    expect(second.x).toBeGreaterThanOrEqual(TERM_W);
    expect(second.y).toBe(first.y);
  });

  it('wraps to a new row above after two columns (LANE_COLS 3 -> 2, canvas review #620 item 3)', () => {
    const taken = [0, 1].map((i) => ({ ...laneSlot(map, []), x: i * (TERM_W + 40), w: TERM_W, h: TERM_H }));
    const next = laneSlot(map, taken);
    expect(next.x).toBe(0);
    expect(next.y).toBe(1000 - 160 - TERM_H * 2 - 40);
  });

  it('reuses a slot freed by a closed window', () => {
    const y = 1000 - TERM_H - 160;
    const taken = [{ x: TERM_W + 40, y, w: TERM_W, h: TERM_H }];
    expect(laneSlot(map, taken).x).toBe(0);
  });
});

describe('nudgeToFreeSlot', () => {
  it('keeps the target spot when nothing occupies it', () => {
    expect(nudgeToFreeSlot({ x: 100, y: 100 }, [])).toEqual({ x: 100, y: 100 });
  });

  it('moves to the nearest free grid cell when the target overlaps', () => {
    const taken = [{ x: 100, y: 100, w: TERM_W, h: TERM_H }];
    const r = nudgeToFreeSlot({ x: 100, y: 100 }, taken);
    expect(r).not.toEqual({ x: 100, y: 100 });
    expect(taken.some((t) => t.x < r.x + TERM_W && r.x < t.x + TERM_W && t.y < r.y + TERM_H && r.y < t.y + TERM_H)).toBe(false);
  });

  it('picks the closer of two free neighbours, not just the first scanned', () => {
    // Every ring-1 cell is taken except straight above — must land there, not
    // fall through to a farther ring-2 cell.
    const step = TERM_W + 40;
    const stepY = TERM_H + 40;
    const target = { x: 0, y: 0 };
    const ring1 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
      .filter(([dx, dy]) => !(dx === 1 && dy === 0)) // leave (1,0) free
      .map(([dx, dy]) => ({ x: target.x + dx * step, y: target.y + dy * stepY, w: TERM_W, h: TERM_H }));
    const taken = [{ ...target, w: TERM_W, h: TERM_H }, ...ring1];
    expect(nudgeToFreeSlot(target, taken)).toEqual({ x: target.x + step, y: target.y });
  });
});

describe('capOpen', () => {
  it('moves the id to the end and drops the least recent past the cap', () => {
    expect(capOpen(['a', 'b'], 'a')).toEqual(['b', 'a']);
    expect(capOpen(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd']);
  });
});

describe('placeWindows', () => {
  const pos = { 'c:a': { x: 0, y: 0 }, 'c:b': { x: 900, y: 600 }, 's:1': { x: 300, y: 300 }, 's:2': { x: 500, y: 300 } };

  it('lines unsaved windows up above the map, side by side', () => {
    const out = placeWindows(pos, {}, ['s:1', 's:2']);
    expect(out['s:1'].y).toBe(-TERM_H - 160);
    expect(out['s:2'].y).toBe(out['s:1'].y);
    expect(out['s:2'].x).toBeGreaterThanOrEqual(out['s:1'].x + TERM_W);
    expect(out['c:a']).toEqual({ x: 0, y: 0 });
  });

  it('keeps a dragged window where the user left it and fills around it', () => {
    const saved = { 'w:1': { x: 0, y: -TERM_H - 160 } };
    const out = placeWindows(pos, saved, ['s:1', 's:2']);
    expect(out['s:1']).toEqual(saved['w:1']);
    expect(out['s:2'].x).toBeGreaterThanOrEqual(TERM_W);
  });

  it('groups windows by area into contiguous slots regardless of arrival order (#598 map cleanup)', () => {
    const areaOf = (id: string): string | undefined => ({ 's:1': 'deck', 's:2': 'itera', 's:3': 'deck' } as Record<string, string>)[id];
    const out = placeWindows(pos, {}, ['s:2', 's:1', 's:3'], undefined, areaOf);
    // deck's two windows fill the first row (LANE_COLS 3 -> 2, canvas review
    // #620 item 3, so a row is only 2 wide now); itera's lone window comes
    // after both, wrapped to the row above, not interleaved between them.
    expect(out['s:1'].y).toBe(out['s:3'].y);
    expect(out['s:1'].x).toBeLessThan(out['s:3'].x);
    expect(out['s:2'].y).toBeLessThan(out['s:3'].y);
  });

  it('nudges a dragged window off another one it was dropped onto — windows never overlap', () => {
    const saved = { 'w:1': { x: 0, y: 0 }, 'w:2': { x: 0, y: 0 } };
    const out = placeWindows(pos, saved, ['s:1', 's:2']);
    expect(out['s:1']).toEqual({ x: 0, y: 0 }); // first in queue keeps the exact spot
    expect(out['s:2']).not.toEqual({ x: 0, y: 0 }); // second gets nudged off it
    const a = { ...out['s:1'], w: TERM_W, h: TERM_H };
    const b = { ...out['s:2'], w: TERM_W, h: TERM_H };
    expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
  });

  it('priority still wins the first slot even with area grouping active', () => {
    const areaOf = () => 'outros';
    const out = placeWindows(pos, {}, ['s:1', 's:2'], new Set(['s:2']), areaOf);
    expect(out['s:2'].x).toBe(0);
    expect(out['s:2'].y).toBe(out['s:1'].y);
    expect(out['s:1'].x).toBeGreaterThanOrEqual(TERM_W);
  });
});

describe('winKey', () => {
  it('stores a session window apart from its card, shells as themselves', () => {
    expect(winKey('s:abc')).toBe('w:abc');
    expect(winKey('t:cv-1')).toBe('t:cv-1');
  });
});

describe('autoAdd', () => {
  it('fills free room with running sessions', () => {
    expect(autoAdd(['a'], ['b', 'c'], 3)).toEqual(['a', 'b', 'c']);
  });

  it('pushes out an idle window, never a running one', () => {
    expect(autoAdd(['idle', 'r1'], ['r1', 'r2'], 2)).toEqual(['r1', 'r2']);
  });

  it('converges when more sessions run than fit', () => {
    const running = Array.from({ length: 10 }, (_, i) => `r${i}`);
    const once = autoAdd([], running, 8);
    expect(once).toHaveLength(8);
    expect(autoAdd(once, running, 8)).toBe(once);
  });

  it('returns the same array when nothing changes', () => {
    const cur = ['a'];
    expect(autoAdd(cur, ['a'])).toBe(cur);
  });
});

describe('MAX_OPEN_TERMS', () => {
  it('is 6, not 8 (canvas review #620 item 3)', () => {
    expect(MAX_OPEN_TERMS).toBe(6);
  });
});

describe('pickRecentSessions', () => {
  const node = (id: string, ref: string, mtime: number): CanvasNode => ({ id, kind: 'session', ref, title: id, subtitle: '', mtime });

  it('puts running ahead of waiting, waiting ahead of an alert, an alert ahead of plain recency', () => {
    const nodes = [node('idle', 'idle', 40), node('run', 'run', 10), node('wait', 'wait', 20), node('hot', 'hot', 30)];
    const stats = { hot: { contextTokens: 190_000, model: 'sonnet' } };
    const picked = pickRecentSessions(nodes, new Set(['run']), new Set(['wait']), stats, 4);
    expect(picked).toEqual(['run', 'wait', 'hot', 'idle']);
  });

  it('breaks ties within the same rank by most recent mtime', () => {
    const nodes = [node('r-old', 'r-old', 10), node('r-new', 'r-new', 20)];
    const picked = pickRecentSessions(nodes, new Set(['r-old', 'r-new']), new Set(), {}, 4);
    expect(picked).toEqual(['r-new', 'r-old']);
  });

  it('caps at max even when everything is running', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => node(`n${i}`, `n${i}`, i));
    const running = new Set(nodes.map((n) => n.ref));
    expect(pickRecentSessions(nodes, running, new Set(), {}, 2)).toHaveLength(2);
  });
});
