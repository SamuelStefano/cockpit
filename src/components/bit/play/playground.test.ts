import { describe, expect, it } from 'vitest';
import { buildScene, chooseAct, type PlayAct, type PlayWorld } from './playground';

const world: PlayWorld = { w: 560, floor: 126, size: 80, ball: 400 };
const from = { x: 280, y: 126, rot: 0, sx: 1, sy: 1, flip: 1 as const };
const ACTS: PlayAct[] = ['stroll', 'look', 'hop', 'wave', 'kick', 'juggle', 'greet'];

describe('playground', () => {
  it.each(ACTS)('%s stays on the floor strip and ends at rest', (act) => {
    const s = buildScene(act, from, { ...world }, () => 0.5, 100);
    for (let t = 0; t <= s.actor.duration; t += 40) {
      const f = s.actor.sample(t);
      expect(f.x).toBeGreaterThanOrEqual(world.size * 0.6 - 0.01);
      expect(f.x).toBeLessThanOrEqual(world.w - world.size * 0.6 + 0.01);
      expect(f.y).toBeLessThanOrEqual(world.floor + 0.01);
    }
    expect(s.actor.sample(s.actor.duration)).toMatchObject({ rot: 0, sx: 1, sy: 1 });
  });

  it('the kicked ball lands where the next scene expects it', () => {
    const s = buildScene('kick', from, { ...world }, () => 0.5);
    const end = s.ball.sample(Math.max(s.actor.duration, s.ball.duration));
    expect(end.x).toBeCloseTo(s.ballX, 0);
    expect(end.y).toBeCloseTo(world.floor - 11);
  });

  it('the juggled ball goes back to the floor', () => {
    const s = buildScene('juggle', from, { ...world }, () => 0.5);
    expect(s.ball.sample(s.actor.duration)).toMatchObject({ x: 400, y: world.floor - 11 });
  });

  it('never picks the same act twice in a row', () => {
    for (let i = 0; i < 20; i++) expect(chooseAct('stroll', () => i / 20)).not.toBe('stroll');
  });
});
