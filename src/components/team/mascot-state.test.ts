import { describe, it, expect } from 'vitest';
import { deriveMascotState, msUntilIdle, DONE_MS } from './mascot-state';

const base = { running: false, now: 1_000_000 };

describe('deriveMascotState', () => {
  it('idle by default', () => {
    expect(deriveMascotState(base)).toBe('idle');
  });
  it('thinking vs working follows the live phase', () => {
    expect(deriveMascotState({ ...base, running: true, phase: 'thinking' })).toBe('thinking');
    expect(deriveMascotState({ ...base, running: true, phase: 'streaming' })).toBe('working');
    expect(deriveMascotState({ ...base, running: true })).toBe('working');
  });
  it('a live turn outranks a failed or waiting leftover', () => {
    expect(deriveMascotState({ ...base, running: true, failed: true, waiting: true })).toBe('working');
  });
  it('waiting on a question outranks a failure', () => {
    expect(deriveMascotState({ ...base, waiting: true, failed: true })).toBe('waiting');
  });
  it('blocked after a failed turn', () => {
    expect(deriveMascotState({ ...base, failed: true })).toBe('blocked');
  });
  it('done only for a while after a clean turn', () => {
    expect(deriveMascotState({ ...base, lastTurnOk: true, endedAt: base.now - 1000 })).toBe('done');
    expect(deriveMascotState({ ...base, lastTurnOk: true, endedAt: base.now - DONE_MS })).toBe('idle');
    expect(deriveMascotState({ ...base, lastTurnOk: true })).toBe('idle');
  });
});

describe('msUntilIdle', () => {
  it('counts down only while done', () => {
    expect(msUntilIdle({ ...base, lastTurnOk: true, endedAt: base.now - 1000 })).toBe(DONE_MS - 1000);
    expect(msUntilIdle(base)).toBeNull();
    expect(msUntilIdle({ ...base, running: true, lastTurnOk: true, endedAt: base.now })).toBeNull();
  });
});
