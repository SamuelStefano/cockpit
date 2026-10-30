// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { savePref } from '../lib/persist';
import { GAME_SOUND_KEY } from '../lib/prefs';
import { sfx, soundOn } from './sfx';

function fakeCtx() {
  const osc = () => ({ type: '', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  const gain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() });
  const created = vi.fn();
  class Ctx {
    state = 'running';
    currentTime = 0;
    destination = {};
    constructor() { created(); }
    createOscillator = vi.fn(osc);
    createGain = vi.fn(gain);
    resume = vi.fn();
  }
  return { Ctx, created };
}

describe('sfx', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is silent by default and never builds an AudioContext', () => {
    const { Ctx, created } = fakeCtx();
    vi.stubGlobal('AudioContext', Ctx);
    window.AudioContext = Ctx as unknown as typeof AudioContext;
    expect(soundOn()).toBe(false);
    sfx.coin();
    expect(created).not.toHaveBeenCalled();
  });

  it('plays with one shared context when enabled', () => {
    const { Ctx, created } = fakeCtx();
    window.AudioContext = Ctx as unknown as typeof AudioContext;
    savePref(GAME_SOUND_KEY, true);
    sfx.coin();
    sfx.levelUp();
    sfx.achievement();
    sfx.error();
    sfx.jump();
    sfx.gameOver();
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without AudioContext', () => {
    savePref(GAME_SOUND_KEY, true);
    // @ts-expect-error simulate absence
    window.AudioContext = undefined;
    expect(() => sfx.coin()).not.toThrow();
  });
});
