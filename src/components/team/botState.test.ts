import { describe, it, expect } from 'vitest';
import { deriveBotState, msUntilIdle, DONE_MS, BOT_STATES, BOT_STATE_LABEL } from './botState';

const base = { running: false, now: 1_000_000 };

describe('deriveBotState', () => {
  it('idle by default', () => {
    expect(deriveBotState(base)).toBe('idle');
  });
  it('thinking vs working follows the live phase', () => {
    expect(deriveBotState({ ...base, running: true, phase: 'thinking' })).toBe('thinking');
    expect(deriveBotState({ ...base, running: true, phase: 'streaming' })).toBe('working');
    expect(deriveBotState({ ...base, running: true })).toBe('working');
  });
  it('a live turn outranks a failed or waiting leftover', () => {
    expect(deriveBotState({ ...base, running: true, failed: true, waiting: true })).toBe('working');
  });
  it('waiting on a question outranks a failure', () => {
    expect(deriveBotState({ ...base, waiting: true, failed: true })).toBe('waiting');
  });
  it('error after a failed turn', () => {
    expect(deriveBotState({ ...base, failed: true })).toBe('error');
  });
  it('done only for a while after a clean turn', () => {
    expect(deriveBotState({ ...base, lastTurnOk: true, endedAt: base.now - 1000 })).toBe('done');
    expect(deriveBotState({ ...base, lastTurnOk: true, endedAt: base.now - DONE_MS })).toBe('idle');
    expect(deriveBotState({ ...base, lastTurnOk: true })).toBe('idle');
  });
});

describe('msUntilIdle', () => {
  it('counts down only while done', () => {
    expect(msUntilIdle({ ...base, lastTurnOk: true, endedAt: base.now - 1000 })).toBe(DONE_MS - 1000);
    expect(msUntilIdle(base)).toBeNull();
    expect(msUntilIdle({ ...base, running: true, lastTurnOk: true, endedAt: base.now })).toBeNull();
  });
});

describe('BOT_STATES', () => {
  it('names the six states of the motion spec', () => {
    expect(BOT_STATES).toEqual(['idle', 'thinking', 'working', 'waiting', 'error', 'done']);
    for (const s of BOT_STATES) expect(BOT_STATE_LABEL[s]).toBeTruthy();
  });
});
