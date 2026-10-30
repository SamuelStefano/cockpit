import { describe, expect, it } from 'vitest';
import { buildExit, buildSkit, pickSkit, SKIT_IDS, RANDOM_SKIT_IDS, WORD_HOLD_MS, thiefFeet, type Stage } from './skits';

const stage: Stage = { w: 760, h: 520, size: 84, letter: { x: 300, y: 200, h: 22 } };

describe('skits', () => {
  it.each(RANDOM_SKIT_IDS)('%s lasts between 4 and 10 s and ends off stage or hidden', (id) => {
    const s = buildSkit(id, stage);
    expect(s.duration).toBeGreaterThanOrEqual(4000);
    expect(s.duration).toBeLessThanOrEqual(10_000);
    const end = s.actor.sample(s.duration);
    const gone = end.x <= -stage.size / 2 || end.x >= stage.w + stage.size / 2 || end.y - stage.size >= stage.h;
    expect(gone).toBe(true);
  });

  it('keeps the word thief out of the random pool but in the gallery list', () => {
    expect(RANDOM_SKIT_IDS).not.toContain('wordthief');
    expect(SKIT_IDS).toContain('wordthief');
  });

  it('the word thief holds the word until released, then returns it and leaves', () => {
    const s = buildSkit('wordthief', stage);
    expect(s.duration).toBeGreaterThan(WORD_HOLD_MS);
    const holding = s.letter!.sample(8000);
    expect(Math.hypot(holding.x - 300, holding.y - 200)).toBeGreaterThan(30);
    expect(s.letter!.sample(s.duration)).toMatchObject({ x: 300, y: 200, rot: 0, s: 1 });
    const end = s.actor.sample(s.duration);
    expect(end.x <= -stage.size / 2 || end.x >= stage.w + stage.size / 2).toBe(true);
  });

  it('a released word thief drops the word home with a bounce while Bit scurries off', () => {
    const s = buildSkit('wordthief', stage);
    const t = 5000;
    const exit = buildExit('wordthief', stage, s.actor.sample(t), s.letter!.sample(t));
    expect(exit.letter).toBeDefined();
    expect(exit.letter!.sample(exit.duration)).toMatchObject({ x: 300, y: 200, rot: 0, s: 1 });
    const ys = Array.from({ length: 80 }, (_, i) => exit.letter!.sample((exit.letter!.duration * i) / 79).y);
    expect(ys.some((y, i) => i > 0 && y < ys[i - 1] - 0.5)).toBe(true);
    const end = exit.actor.sample(exit.duration);
    expect(end.x <= -stage.size / 2 || end.x >= stage.w + stage.size / 2).toBe(true);
  });

  it('the thief puts the letter back exactly where it was', () => {
    const s = buildSkit('thief', stage);
    const end = s.letter!.sample(s.duration);
    expect(end).toMatchObject({ x: 300, y: 200, rot: 0, s: 1 });
  });

  it('the thief really carries the letter away mid-skit', () => {
    const s = buildSkit('thief', stage);
    const mid = s.letter!.sample(s.duration * 0.45);
    expect(Math.hypot(mid.x - 300, mid.y - 200)).toBeGreaterThan(60);
  });

  it('the thief stands below the line and on the side facing the middle', () => {
    expect(thiefFeet(stage)).toMatchObject({ side: 1 });
    expect(thiefFeet({ ...stage, letter: { x: 600, y: 200, h: 22 } }).side).toBe(-1);
    expect(thiefFeet(stage).y).toBeGreaterThan(200 + stage.size * 0.8);
  });

  it('the peek keeps its feet hidden behind the composer', () => {
    const s = buildSkit('peek', stage);
    for (let t = 0; t <= s.duration; t += 50) {
      const f = s.actor.sample(t);
      expect(f.y).toBeGreaterThan(stage.h);
    }
  });

  it('the hurried exit is short and starts where Bit was', () => {
    const from = buildSkit('thief', stage).actor.sample(3000);
    const exit = buildExit('thief', stage, from);
    expect(exit.duration).toBeLessThan(2000);
    expect(exit.actor.sample(0).x).toBeCloseTo(from.x);
    expect(exit.letter).toBeUndefined();
  });

  it('never repeats the previous skit', () => {
    for (let i = 0; i < 20; i++) expect(pickSkit(SKIT_IDS, 'peek', () => i / 20)).not.toBe('peek');
  });
});
