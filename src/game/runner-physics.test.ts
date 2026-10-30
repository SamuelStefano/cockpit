import { describe, it, expect } from 'vitest';
import { initRun, jump, stepRun, runScore, onGround, seededRng, bitRect, GROUND, BIT, type RunState } from './runner-physics';

const step = (s: RunState, secs: number, rng = seededRng(1)) => {
  let cur = s;
  for (let t = 0; t < secs; t += 1 / 60) cur = stepRun(cur, 1 / 60, rng);
  return cur;
};

describe('jump', () => {
  it('only works from the ground', () => {
    const up = jump(initRun());
    expect(up.vy).toBeGreaterThan(0);
    const air = step(up, 0.1);
    expect(air.y).toBeGreaterThan(0);
    expect(jump(air)).toBe(air);
  });
  it('lands again and is grounded', () => {
    const s = step(jump(initRun()), 1, () => 0.99);
    expect(s.y).toBe(0);
    expect(onGround(s)).toBe(true);
  });
  it('does nothing once the run is over', () => {
    const over = { ...initRun(), over: true };
    expect(jump(over)).toBe(over);
  });
});

describe('stepRun', () => {
  it('speeds up and accumulates distance', () => {
    const a = step(initRun(), 2, () => 0.99);
    expect(a.speed).toBeGreaterThan(initRun().speed);
    expect(a.dist).toBeGreaterThan(400);
    expect(runScore(a)).toBeGreaterThan(0);
  });
  it('caps the speed', () => {
    let s = initRun();
    for (let i = 0; i < 4000; i++) s = { ...stepRun({ ...s, obstacles: [] }, 0.05, () => 0.99), obstacles: [] };
    expect(s.speed).toBeLessThanOrEqual(640);
  });
  it('clamps a huge dt (tab was hidden) instead of teleporting', () => {
    const s = stepRun(initRun(), 10);
    expect(s.dist).toBeLessThan(20);
  });
  it('spawns obstacles and culls the ones that left', () => {
    const s = step(initRun(), 3, seededRng(7));
    expect(s.obstacles.length).toBeGreaterThan(0);
    expect(s.obstacles.every((o) => o.x + o.w > -10)).toBe(true);
  });
  it('ends the run on collision', () => {
    const s: RunState = { ...initRun(), obstacles: [{ x: BIT.x + 5, w: 30, h: 30, kind: 'bug' }], nextSpawn: 9999 };
    expect(stepRun(s, 1 / 60).over).toBe(true);
  });
  it('lets a jump clear an obstacle', () => {
    const s: RunState = { ...jump(initRun()), obstacles: [{ x: 200, w: 30, h: 30, kind: 'bug' }], nextSpawn: 9999 };
    let cur = s;
    let clear = true;
    for (let i = 0; i < 90; i++) { cur = stepRun(cur, 1 / 60); if (cur.over) clear = false; }
    expect(clear).toBe(true);
  });
  it('collects a token on contact', () => {
    const r = bitRect(initRun());
    const s: RunState = { ...initRun(), tokens: [{ x: r.x, y: GROUND - r.y - 10 }], nextSpawn: 9999 };
    const n = stepRun(s, 1 / 60);
    expect(n.collected).toBe(1);
    expect(n.tokens).toHaveLength(0);
    expect(runScore(n)).toBeGreaterThanOrEqual(10);
  });
  it('is frozen after game over', () => {
    const over = { ...initRun(), over: true };
    expect(stepRun(over, 0.016)).toBe(over);
  });
  it('is deterministic for a seed', () => {
    expect(step(initRun(), 2, seededRng(5)).obstacles).toEqual(step(initRun(), 2, seededRng(5)).obstacles);
  });
});
