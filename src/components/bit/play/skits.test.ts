import { describe, expect, it } from 'vitest';
import { buildExit, buildSkit, pickSkit, SKIT_IDS, thiefFeet, type Stage } from './skits';

const stage: Stage = { w: 760, h: 520, size: 84, letter: { x: 300, y: 200, h: 22 } };

describe('skits', () => {
  it.each(SKIT_IDS)('%s lasts between 4 and 10 s and ends off stage or hidden', (id) => {
    const s = buildSkit(id, stage);
    expect(s.duration).toBeGreaterThanOrEqual(4000);
    expect(s.duration).toBeLessThanOrEqual(10_000);
    const end = s.actor.sample(s.duration);
    const gone = end.x <= -stage.size / 2 || end.x >= stage.w + stage.size / 2 || end.y - stage.size >= stage.h;
    expect(gone).toBe(true);
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
