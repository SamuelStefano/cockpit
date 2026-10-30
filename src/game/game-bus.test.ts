// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { savePref } from '../lib/persist';
import { GAME_ENABLED_KEY, GAME_STATE_KEY } from '../lib/prefs';
import { recordGameEvent, getGameState, subscribeRewards, subscribeGame, claimGameOnce } from './game-bus';

const now = new Date(2026, 9, 30, 12);

describe('game-bus', () => {
  beforeEach(() => localStorage.clear());

  it('records, persists and publishes rewards', () => {
    const rewards = vi.fn();
    const state = vi.fn();
    const off = subscribeRewards(rewards);
    const offS = subscribeGame(state);
    recordGameEvent({ type: 'turn_done' }, now);
    expect(getGameState().totals.turn_done).toBe(1);
    expect(rewards).toHaveBeenCalledTimes(1);
    expect(state).toHaveBeenCalledTimes(1);
    off(); offS();
  });

  it('is a no-op when disabled', () => {
    savePref(GAME_ENABLED_KEY, false);
    const rewards = vi.fn();
    const off = subscribeRewards(rewards);
    recordGameEvent({ type: 'turn_done' }, now);
    expect(getGameState().xp).toBe(0);
    expect(rewards).not.toHaveBeenCalled();
    expect(claimGameOnce('x', '1')).toBe(false);
    off();
  });

  it('counts a replayed event with the same key once', () => {
    recordGameEvent({ type: 'turn_done', key: 's1' }, now);
    recordGameEvent({ type: 'turn_done', key: 's1' }, now);
    expect(getGameState().totals.turn_done).toBe(1);
    recordGameEvent({ type: 'turn_done', key: 's1' }, new Date(now.getTime() + 6000));
    expect(getGameState().totals.turn_done).toBe(2);
  });

  it('survives corrupt storage and a throwing listener', () => {
    localStorage.setItem('cockpit:' + GAME_STATE_KEY, '{not json');
    const off = subscribeRewards(() => { throw new Error('boom'); });
    expect(() => recordGameEvent({ type: 'turn_done' }, now)).not.toThrow();
    off();
  });

  it('claims a once-guard a single time per stamp', () => {
    expect(claimGameOnce('halloween', '2026')).toBe(true);
    expect(claimGameOnce('halloween', '2026')).toBe(false);
  });
});
