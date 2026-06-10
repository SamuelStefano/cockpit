import { describe, it, expect } from 'vitest';
import { ctxPercent, ctxWarn, isIdle, fmtRunElapsed, CTX_WINDOW } from './row-meta';

describe('ctxPercent', () => {
  it('returns null when there is no context reading', () => {
    expect(ctxPercent(undefined)).toBeNull();
    expect(ctxPercent(0)).toBeNull();
    expect(ctxPercent(-5)).toBeNull();
  });

  it('rounds the share of the window to an integer', () => {
    expect(ctxPercent(CTX_WINDOW / 2)).toBe(50);
    expect(ctxPercent(1234)).toBe(1); // 0.617% → 1
  });

  it('caps at 100 when context exceeds the window', () => {
    expect(ctxPercent(CTX_WINDOW * 2)).toBe(100);
  });
});

describe('ctxWarn', () => {
  it('silent below 70%', () => {
    expect(ctxWarn(undefined)).toBeNull();
    expect(ctxWarn(0)).toBeNull();
    expect(ctxWarn(CTX_WINDOW * 0.5)).toBeNull();
    expect(ctxWarn(CTX_WINDOW * 0.69)).toBeNull();
  });

  it('yellow from 70%, red from 90%', () => {
    expect(ctxWarn(CTX_WINDOW * 0.7)).toEqual({ pct: 70, tone: 'yellow' });
    expect(ctxWarn(CTX_WINDOW * 0.89)).toEqual({ pct: 89, tone: 'yellow' });
    expect(ctxWarn(CTX_WINDOW * 0.9)).toEqual({ pct: 90, tone: 'red' });
    expect(ctxWarn(CTX_WINDOW * 2)).toEqual({ pct: 100, tone: 'red' });
  });
});

describe('isIdle', () => {
  const now = 10 * 24 * 60 * 60 * 1000; // 10d em ms
  const day = 24 * 60 * 60 * 1000;

  it('flags a session with no activity for over a week', () => {
    expect(isIdle(now - 8 * day, false, now)).toBe(true);
  });

  it('does not flag a recently-touched session', () => {
    expect(isIdle(now - 2 * day, false, now)).toBe(false);
  });

  it('never flags a running session, even if cold', () => {
    expect(isIdle(now - 30 * day, true, now)).toBe(false);
  });

  it('treats exactly the threshold as not-yet-idle', () => {
    expect(isIdle(now - 7 * day, false, now)).toBe(false);
  });
});

describe('fmtRunElapsed', () => {
  it('shows seconds under a minute', () => expect(fmtRunElapsed(45_000)).toBe('45s'));
  it('shows minutes and seconds under an hour', () => expect(fmtRunElapsed((3 * 60 + 12) * 1000)).toBe('3m 12s'));
  it('shows hours and minutes past an hour', () => expect(fmtRunElapsed((2 * 60 + 5) * 60_000)).toBe('2h 5m'));
});
