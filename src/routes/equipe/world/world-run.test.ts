import { describe, it, expect } from 'vitest';
import metaRaw from '../../../../public/world/v2/fx/dust.json?raw';
import exteriorRaw from '../../../../public/world/v2/tiles-exterior.json?raw';
import {
  DUST_ANCHOR, DUST_FPS, DUST_FRAME, DUST_FRAMES, DUST_INTERVAL_MS, DUST_POOL, LOOKAHEAD_MAX, RUN_FRAME_MS, WALK_FRAME_MS,
  dustAllowed, dustTick, legFrameMs, lookahead, runSpeed, stickRuns, surfaceOfItem, surfaceOfProps,
} from './world-run';

describe('runSpeed', () => {
  it('keeps the walk speed and runs 1.6x faster', () => {
    expect(runSpeed(72, false)).toBe(72);
    expect(runSpeed(72, true)).toBeCloseTo(115.2);
  });

  it('uses a faster leg cadence when running', () => {
    expect(legFrameMs(false)).toBe(WALK_FRAME_MS);
    expect(legFrameMs(true)).toBe(RUN_FRAME_MS);
    expect(RUN_FRAME_MS).toBeLessThan(WALK_FRAME_MS);
  });
});

describe('stickRuns', () => {
  it('runs only past 90% of the stick radius', () => {
    expect(stickRuns(0.89)).toBe(false);
    expect(stickRuns(0.9)).toBe(true);
    expect(stickRuns(1)).toBe(true);
  });
});

describe('dustTick', () => {
  it('emits one puff per interval at 60 fps', () => {
    let acc = 0;
    let puffs = 0;
    for (let i = 0; i < 72; i++) { const t = dustTick(acc, 1000 / 60, true); acc = t.acc; puffs += t.count; }
    expect(puffs).toBe(Math.floor(1200 / DUST_INTERVAL_MS));
  });

  it('emits nothing and resets the clock when not running', () => {
    expect(dustTick(100, 500, false)).toEqual({ count: 0, acc: 0 });
  });

  it('keeps the remainder between frames', () => {
    expect(dustTick(100, 30, true)).toEqual({ count: 1, acc: 10 });
    expect(dustTick(0, 50, true)).toEqual({ count: 0, acc: 50 });
  });

  it('never emits more than the pool after a long frame', () => {
    const t = dustTick(0, 60_000, true);
    expect(t.count).toBe(DUST_POOL);
    expect(t.acc).toBeLessThan(DUST_INTERVAL_MS);
  });

  it('ignores a non-positive dt', () => {
    expect(dustTick(40, 0, true)).toEqual({ count: 0, acc: 40 });
  });
});

describe('lookahead', () => {
  const settle = (dx: number, dy: number, from = { x: 0, y: 0 }, ms = 4000) => {
    let o = from;
    for (let t = 0; t < ms; t += 16) o = lookahead(o, dx, dy, 16);
    return o;
  };

  it('eases toward the movement direction without jumping', () => {
    const o = lookahead({ x: 0, y: 0 }, 1, 0, 16);
    expect(o.x).toBeGreaterThan(0);
    expect(o.x).toBeLessThan(6);
    expect(o.y).toBe(0);
  });

  it('settles at the max offset and never passes it', () => {
    const o = settle(1, 0);
    expect(o.x).toBeCloseTo(LOOKAHEAD_MAX, 1);
    const d = settle(3, 3);
    expect(Math.hypot(d.x, d.y)).toBeLessThanOrEqual(LOOKAHEAD_MAX + 1e-9);
    expect(d.x).toBeCloseTo(d.y);
  });

  it('clamps an oversized previous offset', () => {
    const o = lookahead({ x: 500, y: 0 }, 1, 0, 16);
    expect(o.x).toBeLessThanOrEqual(LOOKAHEAD_MAX);
  });

  it('returns to exactly zero when stopped', () => {
    expect(settle(0, 0, { x: LOOKAHEAD_MAX, y: -20 })).toEqual({ x: 0, y: 0 });
  });

  it('is frame-rate independent', () => {
    const a = lookahead({ x: 0, y: 0 }, 0, -1, 100);
    let b = { x: 0, y: 0 };
    for (let i = 0; i < 10; i++) b = lookahead(b, 0, -1, 10);
    expect(a.y).toBeCloseTo(b.y, 6);
  });
});

describe('dust atlas', () => {
  it('matches the generated dust.json', () => {
    const a = (JSON.parse(metaRaw) as { animations: Record<string, { frame_w: number; frame_h: number; frames: number; fps: number; anchor: number[]; loop: boolean }> }).animations.dust_run!;
    expect([a.frame_w, a.frame_h, a.frames, a.fps]).toEqual([DUST_FRAME, DUST_FRAME, DUST_FRAMES, DUST_FPS]);
    expect(a.anchor).toEqual([DUST_ANCHOR.x, DUST_ANCHOR.y]);
    expect(a.loop).toBe(false);
  });
});

describe('dustAllowed', () => {
  it('raises dust on grass, dirt and sand only', () => {
    expect(['grass', 'dirt', 'sand'].map((s) => dustAllowed(s as never))).toEqual([true, true, true]);
    expect(['wood', 'paved', 'floor', 'water'].map((s) => dustAllowed(s as never))).toEqual([false, false, false, false]);
  });

  it('keeps the puff on a surface the map does not describe', () => {
    expect(dustAllowed('unknown')).toBe(true);
  });
});

describe('surfaceOfItem', () => {
  it('maps the v2 ground items to a surface', () => {
    expect(surfaceOfItem('grass_2')).toBe('grass');
    expect(surfaceOfItem('auto_grass_path')).toBe('grass');
    expect(surfaceOfItem('dirt')).toBe('dirt');
    expect(surfaceOfItem('sand')).toBe('sand');
    expect(surfaceOfItem('dock_planks_v')).toBe('wood');
    expect(surfaceOfItem('plaza_pavers_cracked')).toBe('paved');
    expect(surfaceOfItem('auto_grass_plaza')).toBe('paved');
    expect(surfaceOfItem('sidewalk_curb_ne')).toBe('paved');
    expect(surfaceOfItem('floor_wood_h')).toBe('floor');
    expect(surfaceOfItem('carpet_red')).toBe('floor');
    expect(surfaceOfItem('water')).toBe('water');
    expect(surfaceOfItem('bench_front')).toBe('unknown');
    expect(surfaceOfItem(undefined)).toBe('unknown');
  });

  it('knows every ground item of the exterior tileset', () => {
    const items = Object.keys((JSON.parse(exteriorRaw) as { items: Record<string, unknown> }).items);
    const ground = items.slice(0, items.indexOf('tree_round_canopy'));
    expect(ground.length).toBeGreaterThan(30);
    expect(ground.filter((n) => surfaceOfItem(n) === 'unknown')).toEqual([]);
  });
});

describe('surfaceOfProps', () => {
  it('reads the surface tile property', () => {
    expect(surfaceOfProps({ surface: 'wood' })).toBe('wood');
    expect(surfaceOfProps({ surface: 'lava' })).toBe('unknown');
  });

  it('treats the floor flag of the old map as a floor', () => {
    expect(surfaceOfProps({ floor: true })).toBe('floor');
    expect(dustAllowed(surfaceOfProps({ floor: true }))).toBe(false);
  });

  it('is unknown without properties', () => {
    expect(surfaceOfProps(undefined)).toBe('unknown');
    expect(surfaceOfProps({ block: true })).toBe('unknown');
  });
});
