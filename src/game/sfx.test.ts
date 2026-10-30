// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { savePref } from '../lib/persist';
import { GAME_SOUND_KEY, NOTIFY_SOUND_KEY } from '../lib/prefs';
import { sfx, soundOn, resetSfxForTests, MASTER, AMBIENT_GAP_MS, installAudioUnlock } from './sfx';

function fakeCtx(state = 'running') {
  const gains: number[] = [];
  const osc = () => ({ type: '', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  const gain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn((v: number) => { gains.push(v); }) }, connect: vi.fn() });
  const created = vi.fn();
  const instances: { state: string; resume: ReturnType<typeof vi.fn>; createOscillator: ReturnType<typeof vi.fn> }[] = [];
  class Ctx {
    state = state;
    currentTime = 0;
    destination = {};
    constructor() { created(); instances.push(this); }
    createOscillator = vi.fn(osc);
    createGain = vi.fn(gain);
    resume = vi.fn();
  }
  return { Ctx, created, gains, instances };
}
const install = (Ctx: unknown) => { window.AudioContext = Ctx as typeof AudioContext; };
const setHidden = (v: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => v });

describe('sfx', () => {
  beforeEach(() => { localStorage.clear(); resetSfxForTests(); vi.useFakeTimers(); vi.setSystemTime(10_000); setHidden(false); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); setHidden(false); });

  it('is on by default and plays with one shared context', () => {
    const { Ctx, created } = fakeCtx();
    install(Ctx);
    expect(soundOn()).toBe(true);
    sfx.coin(); sfx.levelUp(); sfx.achievement(); sfx.error();
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the toggle is off', () => {
    const { Ctx, created } = fakeCtx();
    install(Ctx);
    savePref(GAME_SOUND_KEY, false);
    sfx.coin();
    expect(created).not.toHaveBeenCalled();
  });

  it('is a no-op without AudioContext', () => {
    // @ts-expect-error simulate absence
    window.AudioContext = undefined;
    expect(() => sfx.coin()).not.toThrow();
  });

  it('applies the master gain', () => {
    const { Ctx, gains } = fakeCtx();
    install(Ctx);
    sfx.coin();
    expect(gains.every((g) => g <= 0.07 * MASTER + 1e-9)).toBe(true);
  });

  it('allows one ambient sound per gap, but never limits game sounds', () => {
    const { Ctx, instances } = fakeCtx();
    install(Ctx);
    sfx.tick(); sfx.send();
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1);
    vi.setSystemTime(10_000 + AMBIENT_GAP_MS + 1);
    sfx.splash();
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(3);
    sfx.coin(); sfx.coin();
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(7);
  });

  it('drops sounds while the context is suspended instead of queueing them', () => {
    const { Ctx, instances } = fakeCtx('suspended');
    install(Ctx);
    sfx.coin();
    expect(instances[0].resume).toHaveBeenCalled();
    expect(instances[0].createOscillator).not.toHaveBeenCalled();
  });

  it('is silent in a hidden tab, except the turn cues', () => {
    const { Ctx, instances } = fakeCtx();
    install(Ctx);
    setHidden(true);
    sfx.tick(); sfx.coin(); sfx.send();
    expect(instances.length).toBe(0);
    sfx.turnDone();
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2);
  });

  it('leaves the hidden-tab turn beep to notify.ts when its sound is on', () => {
    const { Ctx, instances } = fakeCtx();
    install(Ctx);
    savePref(NOTIFY_SOUND_KEY, true);
    setHidden(true);
    sfx.turnDone();
    expect(instances.length).toBe(0);
    setHidden(false);
    sfx.turnDone();
    expect(instances[0].createOscillator).toHaveBeenCalled();
  });

  it('resumes the context on the first gesture, once', () => {
    const { Ctx, instances } = fakeCtx('suspended');
    install(Ctx);
    installAudioUnlock();
    window.dispatchEvent(new Event('pointerdown'));
    expect(instances[0].resume).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('pointerdown'));
    expect(instances[0].resume).toHaveBeenCalledTimes(1);
  });
});
