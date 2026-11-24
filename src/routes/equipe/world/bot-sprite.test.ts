import { describe, expect, it } from 'vitest';
import botsRaw from '../../../../public/world/v2/bots.json?raw';
import { V2_FRAME_H, V2_FRAME_W, V2_GAIT, V2_SHEET_COLS, distinctSpriteKeys, gaitOf, sheetFrame, spriteKey, spritePath, textureKey, v2GaitFrame } from './bot-sprite';
import { legFrameMs } from './world-run';

describe('spriteKey', () => {
  it('accepts safe keys', () => {
    expect(spriteKey('workers')).toBe('workers');
    expect(spriteKey('a-1')).toBe('a-1');
  });
  it('rejects unsafe or unknown shapes', () => {
    for (const k of ['', '../x', 'a/b', 'A', 'a.png', 'x'.repeat(25), 'urban', 'town', undefined, 3, null]) {
      expect(spriteKey(k)).toBeNull();
    }
  });
  it('builds fixed paths', () => {
    expect(spritePath('/', 'workers')).toBe('/world/workers.png');
    expect(textureKey('workers')).toBe('bot-workers');
  });
});

describe('sheetFrame', () => {
  it('maps 4 facings x 3 rows', () => {
    expect(sheetFrame(0, 'left')).toBe(0);
    expect(sheetFrame(0, 'right')).toBe(3);
    expect(sheetFrame(1, 'down')).toBe(5);
    expect(sheetFrame(2, 'up')).toBe(10);
  });
  it('clamps rows', () => {
    expect(sheetFrame(9, 'left')).toBe(8);
    expect(sheetFrame(-1, 'left')).toBe(0);
  });
});

describe('distinctSpriteKeys', () => {
  it('dedupes and drops invalid', () => {
    expect(distinctSpriteKeys([{ sprite: 'workers' }, { sprite: 'workers' }, { sprite: '../x' }, {}])).toEqual(['workers']);
  });
});

describe('village sheet gaits', () => {
  const meta = JSON.parse(botsRaw) as {
    frame: { w: number; h: number };
    sheet: { w: number; h: number; columns: number };
    animations: Record<string, { rows: Record<string, number>; frames: number; fps: number }>;
  };

  it('matches the generated bots.json', () => {
    expect([meta.frame.w, meta.frame.h, meta.sheet.columns]).toEqual([V2_FRAME_W, V2_FRAME_H, V2_SHEET_COLS]);
    for (const gait of ['walk', 'run'] as const) {
      const a = meta.animations[gait]!;
      expect({ rows: a.rows, frames: a.frames, fps: a.fps }).toEqual(V2_GAIT[gait]);
      expect(Math.max(...Object.values(a.rows)) * V2_FRAME_H).toBeLessThan(meta.sheet.h);
    }
  });
  it('has a run of at least 3 frames on its own rows', () => {
    expect(V2_GAIT.run.frames).toBeGreaterThanOrEqual(3);
    const walkRows = Object.values(V2_GAIT.walk.rows);
    for (const r of Object.values(V2_GAIT.run.rows)) expect(walkRows).not.toContain(r);
  });
  it('plays the run rows only while running', () => {
    expect(gaitOf(true)).toBe('run');
    expect(gaitOf(false)).toBe('walk');
    expect(v2GaitFrame(false, 'left', 0, legFrameMs(false))).toBe(4 * 8);
    expect(v2GaitFrame(true, 'left', 0, legFrameMs(true))).toBe(32 * 8);
    expect(v2GaitFrame(true, 'right', 80 * 2, 80)).toBe(35 * 8 + 2);
  });
  it('loops over the frames at the given cadence', () => {
    expect(v2GaitFrame(true, 'down', 80 * 6, 80)).toBe(33 * 8);
    expect(v2GaitFrame(true, 'down', 80 * 5 + 79, 80)).toBe(33 * 8 + 5);
    expect(v2GaitFrame(false, 'up', 130 * 7, 130)).toBe(6 * 8 + 1);
    expect(v2GaitFrame(true, 'up', -5, 0)).toBe(34 * 8);
  });
});
