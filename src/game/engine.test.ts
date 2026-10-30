import { describe, it, expect } from 'vitest';
import { applyEvent, emptyState, level, loadState, claimOnce, dayKey, daysBetween, xpForLevel, normalizeRoute, LIGHT_XP_DAILY_CAP } from './engine';
import type { GameEvent, GameState } from './types';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const run = (s: GameState, ev: GameEvent, now: Date) => applyEvent(s, ev, now);
const done: GameEvent = { type: 'turn_done' };

describe('level', () => {
  it('starts at 1 as Estagiário and grows with a steeper curve', () => {
    expect(level(0)).toMatchObject({ level: 1, title: 'Estagiário de Prompt' });
    const gaps = [1, 2, 3, 4, 5].map((l) => xpForLevel(l + 1) - xpForLevel(l));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
  });
  it('maps tiers to titles', () => {
    expect(level(xpForLevel(5)).title).toBe('Dev Júnior');
    expect(level(xpForLevel(10)).title).toBe('Pleno Confiante');
    expect(level(xpForLevel(17)).title).toBe('Sênior de Terminal');
    expect(level(xpForLevel(25)).title).toBe('Staff do Caos');
    expect(level(xpForLevel(35)).title).toBe('Arquiteto de Agentes');
    expect(level(xpForLevel(50)).title).toBe('Lenda do Deck');
  });
  it('reports progress inside the level', () => {
    const l = level(xpForLevel(2) + 1);
    expect(l.level).toBe(2);
    expect(l.pct).toBeGreaterThan(0);
    expect(l.pct).toBeLessThan(1);
  });
  it('tolerates junk xp', () => {
    expect(level(-5).level).toBe(1);
    expect(level(NaN).level).toBe(1);
  });
});

describe('applyEvent basics', () => {
  it('gives the most xp to turn_done and unlocks the first-turn achievement', () => {
    const r = run(emptyState(), done, at(2026, 10, 30));
    expect(r.state.totals.turn_done).toBe(1);
    expect(r.rewards).toContainEqual({ kind: 'achievement', id: 'first-turn' });
    expect(r.rewards).toContainEqual({ kind: 'xp', amount: 25, source: 'turn_done' });
  });
  it('does not mutate the input state', () => {
    const s = emptyState();
    run(s, done, at(2026, 10, 30));
    expect(s.xp).toBe(0);
    expect(s.totals).toEqual({});
  });
  it('emits a level reward when xp crosses a threshold', () => {
    const s = emptyState();
    s.xp = xpForLevel(2) - 1;
    const r = run(s, { type: 'turn_error' }, at(2026, 10, 30));
    expect(r.rewards.find((x) => x.kind === 'level')).toMatchObject({ level: 2 });
  });
  it('caps message xp per day and resets next day', () => {
    let s = emptyState();
    for (let i = 0; i < 30; i++) s = run(s, { type: 'message_sent' }, at(2026, 10, 30)).state;
    expect(s.daily.msgXp).toBe(LIGHT_XP_DAILY_CAP);
    const xpBefore = s.xp;
    s = run(s, { type: 'message_sent' }, at(2026, 10, 30)).state;
    expect(s.xp).toBe(xpBefore);
    s = run(s, { type: 'message_sent' }, at(2026, 10, 31)).state;
    expect(s.daily.msgXp).toBe(3);
  });
  it('tracks high score and awards capped xp', () => {
    const r = run(emptyState(), { type: 'game_score', score: 5000 }, at(2026, 10, 30));
    expect(r.state.highScore).toBe(5000);
    expect(r.rewards).toContainEqual({ kind: 'xp', amount: 30, source: 'game_score' });
    expect(run(r.state, { type: 'game_score', score: 10 }, at(2026, 10, 30)).state.highScore).toBe(5000);
  });
  it('records a route once', () => {
    let r = run(emptyState(), { type: 'route_visit', route: '/configuracoes/uso' }, at(2026, 10, 30));
    expect(r.state.routes).toEqual(['/configuracoes']);
    r = run(r.state, { type: 'route_visit', route: '/configuracoes' }, at(2026, 10, 30));
    expect(r.state.routes).toEqual(['/configuracoes']);
  });
  it('records an egg once', () => {
    let r = run(emptyState(), { type: 'egg_found', egg: 'konami' }, at(2026, 10, 30));
    expect(r.rewards).toContainEqual({ kind: 'achievement', id: 'egg-konami' });
    const xp = r.state.xp;
    r = run(r.state, { type: 'egg_found', egg: 'konami' }, at(2026, 10, 30));
    expect(r.state.xp).toBe(xp);
    expect(r.state.eggs).toEqual(['konami']);
  });
});

describe('streak', () => {
  it('same-day repeat does not grow it', () => {
    let s = run(emptyState(), done, at(2026, 10, 30, 9)).state;
    s = run(s, done, at(2026, 10, 30, 18)).state;
    expect(s.streak.current).toBe(1);
  });
  it('grows on consecutive days across midnight, month and year', () => {
    let s = run(emptyState(), done, at(2026, 12, 30, 23)).state;
    s = run(s, done, at(2026, 12, 31, 0)).state;
    s = run(s, done, at(2027, 1, 1, 8)).state;
    expect(s.streak).toMatchObject({ current: 3, best: 3 });
  });
  it('one missed day resets to 1 but keeps best', () => {
    let s = run(emptyState(), done, at(2026, 10, 28)).state;
    s = run(s, done, at(2026, 10, 29)).state;
    s = run(s, done, at(2026, 10, 31)).state;
    expect(s.streak).toMatchObject({ current: 1, best: 2 });
  });
  it('a clock that goes backwards leaves it alone', () => {
    let s = run(emptyState(), done, at(2026, 10, 30)).state;
    s = run(s, done, at(2026, 10, 29)).state;
    expect(s.streak.current).toBe(1);
    expect(s.streak.lastDay).toBe('2026-10-30');
  });
  it('survives a DST-length day', () => {
    expect(daysBetween('2026-10-24', '2026-10-25')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
  it('emits a streak reward from day 2', () => {
    const s = run(emptyState(), done, at(2026, 10, 29)).state;
    const r = run(s, done, at(2026, 10, 30));
    expect(r.rewards).toContainEqual({ kind: 'streak', days: 2 });
    expect(r.state.unlocked['streak-3']).toBeUndefined();
  });
});

describe('time-based achievements', () => {
  it('night owl at 02:00', () => {
    expect(run(emptyState(), done, at(2026, 10, 30, 2)).state.unlocked['night-owl']).toBeDefined();
    expect(run(emptyState(), done, at(2026, 10, 30, 12)).state.unlocked['night-owl']).toBeUndefined();
  });
  it('comeback needs a turn_done right after an error', () => {
    let s = run(emptyState(), { type: 'turn_error' }, at(2026, 10, 30)).state;
    expect(s.unlocked.comeback).toBeUndefined();
    s = run(s, done, at(2026, 10, 30)).state;
    expect(s.unlocked.comeback).toBeDefined();
  });
  it('programmers day gives a one-off bonus per year', () => {
    const a = run(emptyState(), done, at(2026, 9, 13));
    const b = run(a.state, done, at(2026, 9, 13));
    expect(a.rewards.filter((r) => r.kind === 'xp' && r.amount === 100)).toHaveLength(1);
    expect(b.rewards.filter((r) => r.kind === 'xp' && r.amount === 100)).toHaveLength(0);
  });
});

describe('daily quests', () => {
  it('resets progress on a new day and gives the bonus when all 3 are done', () => {
    let s = emptyState();
    const events: GameEvent[] = [done, { type: 'message_sent' }, { type: 'session_new' }, { type: 'route_visit', route: '/x' }, { type: 'palette_open' }, { type: 'fish_caught' }, { type: 'game_score', score: 200, concurrent: 2 }];
    let bonus = false;
    for (let round = 0; round < 10; round++) {
      for (const ev of events) {
        const r = run(s, { ...ev, concurrent: 2 }, at(2026, 10, 30, round % 2 ? 19 : 7));
        s = r.state;
        if (r.rewards.some((x) => x.kind === 'quest' && x.bonus)) bonus = true;
      }
    }
    expect(s.daily.done).toHaveLength(3);
    expect(bonus || s.daily.bonus).toBe(true);
    const next = run(s, { type: 'turn_error' }, at(2026, 10, 31));
    expect(next.state.daily.done).toEqual([]);
    expect(next.state.daily.bonus).toBe(false);
  });
});

describe('loadState', () => {
  it('survives garbage', () => {
    for (const bad of [null, 5, 'x', [], { xp: 'a', streak: 3, totals: [1], eggs: 'no', unlocked: { a: 1 } }]) {
      const s = loadState(bad);
      expect(s.xp).toBe(0);
      expect(Array.isArray(s.eggs)).toBe(true);
      expect(s.streak.current).toBe(0);
    }
  });
  it('keeps valid fields and drops negatives', () => {
    const s = loadState({ xp: 120, highScore: -4, eggs: ['konami', 4], streak: { current: 2, best: 5, lastDay: '2026-10-30' } });
    expect(s).toMatchObject({ xp: 120, highScore: 0, eggs: ['konami'], streak: { current: 2, best: 5, lastDay: '2026-10-30' } });
  });
  it('round-trips an applied state', () => {
    const r = run(emptyState(), done, at(2026, 10, 30));
    expect(loadState(JSON.parse(JSON.stringify(r.state)))).toEqual(r.state);
  });
});

describe('helpers', () => {
  it('claimOnce guards a stamp', () => {
    const a = claimOnce(emptyState(), 'halloween', '2026');
    expect(a.claimed).toBe(true);
    expect(claimOnce(a.state, 'halloween', '2026').claimed).toBe(false);
    expect(claimOnce(a.state, 'halloween', '2027').claimed).toBe(true);
  });
  it('dayKey uses local fields', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('normalizes routes', () => {
    expect(normalizeRoute('/c/abc')).toBe('/');
    expect(normalizeRoute('/skills/x')).toBe('/skills');
    expect(normalizeRoute('/conexoes#ferramentas')).toBe('/conexoes');
  });
});

describe('fish_caught', () => {
  const now = at(2026, 10, 30);
  it('pays a little xp, counts the catch and unlocks the first-catch achievement', () => {
    const { state, rewards } = run(emptyState(), { type: 'fish_caught' }, now);
    expect(state.totals.fish_caught).toBe(1);
    expect(state.xp).toBeGreaterThan(0);
    expect(rewards.some((r) => r.kind === 'achievement' && r.id === 'fish-1')).toBe(true);
    expect(state.unlocked['fish-star']).toBeUndefined();
  });
  it('the rare star unlocks its achievement and pays extra', () => {
    const common = run(emptyState(), { type: 'fish_caught' }, now).state.xp;
    const { state } = run(emptyState(), { type: 'fish_caught', rare: true }, now);
    expect(state.unlocked['fish-star']).toBeDefined();
    expect(state.xp).toBeGreaterThan(common);
  });
  it('25 catches unlock the bucket achievement', () => {
    let s = emptyState();
    for (let i = 0; i < 25; i++) s = run(s, { type: 'fish_caught' }, now).state;
    expect(s.unlocked['fish-25']).toBeDefined();
  });
});
