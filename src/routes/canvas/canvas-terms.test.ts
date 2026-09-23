import { describe, expect, it } from 'vitest';
import { capOpen, isWatchTerm, laneSlot, newShellId, placeWindows, shellNodes, TERM_H, TERM_W, watchTermId } from './canvas-terms';

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
  it('turns plain tmux sessions into shell nodes and skips session watchers', () => {
    const nodes = shellNodes(['main', 'w-abc', 'cv-1'], 5);
    expect(nodes.map((n) => n.id)).toEqual(['t:cv-1', 't:main']);
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

  it('wraps to a new row above after three columns', () => {
    const taken = [0, 1, 2].map((i) => ({ ...laneSlot(map, []), x: i * (TERM_W + 40), w: TERM_W, h: TERM_H }));
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
    const saved = { 's:1': { x: 0, y: -TERM_H - 160 } };
    const out = placeWindows({ ...pos, ...saved }, saved, ['s:1', 's:2']);
    expect(out['s:1']).toEqual(saved['s:1']);
    expect(out['s:2'].x).toBeGreaterThanOrEqual(TERM_W);
  });
});
