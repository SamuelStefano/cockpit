// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { savePref } from '../lib/persist';
import { GAME_ENABLED_KEY } from '../lib/prefs';
import { subscribeToast } from '../components/primitives/toast-bus';
import { subscribeConfetti } from '../components/primitives/confetti-bus';
import { checkSeasonal } from './useSeasonalEggs';
import { getGameState } from './game-bus';

function collect() {
  const msgs: string[] = [];
  const off = subscribeToast((t) => msgs.push(t.message));
  return { msgs, off };
}

describe('checkSeasonal', () => {
  beforeEach(() => localStorage.clear());

  it('fires the Halloween toast once and records the egg', () => {
    const { msgs, off } = collect();
    checkSeasonal(new Date(2026, 9, 31, 10));
    checkSeasonal(new Date(2026, 9, 31, 11));
    expect(msgs.filter((m) => m.includes('abóbora'))).toHaveLength(1);
    expect(getGameState().eggs).toContain('halloween');
    off();
  });

  it('fires the Friday joke once per day, only from 16:00', () => {
    const { msgs, off } = collect();
    checkSeasonal(new Date(2026, 10, 6, 15, 0));
    expect(msgs).toHaveLength(0);
    checkSeasonal(new Date(2026, 10, 6, 16, 5));
    checkSeasonal(new Date(2026, 10, 6, 17, 0));
    expect(msgs.filter((m) => m.includes('Deploy? Coragem'))).toHaveLength(1);
    checkSeasonal(new Date(2026, 10, 13, 16, 5));
    expect(msgs.filter((m) => m.includes('Deploy? Coragem'))).toHaveLength(2);
    off();
  });

  it('fires New Year confetti once', () => {
    const fn = vi.fn();
    const off = subscribeConfetti(fn);
    checkSeasonal(new Date(2027, 0, 1, 9));
    checkSeasonal(new Date(2027, 0, 1, 10));
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it('does nothing on an ordinary Thursday or when the game is off', () => {
    const { msgs, off } = collect();
    checkSeasonal(new Date(2026, 9, 29, 12));
    savePref(GAME_ENABLED_KEY, false);
    checkSeasonal(new Date(2026, 9, 31, 12));
    expect(msgs).toHaveLength(0);
    off();
  });
});
