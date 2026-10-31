import { describe, it, expect } from 'vitest';
import { wordThiefReady, movedEnough, WORD_IDLE_MS, WORD_COOLDOWN_MS, WORD_TYPING_MS, type WordThiefContext } from './word-thief';

const ready: WordThiefContext = {
  now: 1_000_000, lastMove: 1_000_000 - WORD_IDLE_MS, mouseSeen: true, hidden: false, selectionActive: false,
  composerFocused: false, lastKey: 0, lastEnd: 0, stageBusy: false, turnRunning: false, allowed: true,
};

describe('wordThiefReady', () => {
  it('fires after 25 s of a still mouse on a visible tab', () => {
    expect(wordThiefReady(ready)).toBe(true);
    expect(wordThiefReady({ ...ready, lastMove: ready.now - WORD_IDLE_MS + 1 })).toBe(false);
  });
  it.each([
    ['hidden tab', { hidden: true }],
    ['selected text', { selectionActive: true }],
    ['a mouse never seen', { mouseSeen: false }],
    ['play off', { allowed: false }],
    ['another skit on stage', { stageBusy: true }],
    ['a turn streaming', { turnRunning: true }],
  ])('never with %s', (_n, patch) => {
    expect(wordThiefReady({ ...ready, ...patch })).toBe(false);
  });
  it('never while typing in the composer, but fine once the typing has stopped', () => {
    expect(wordThiefReady({ ...ready, composerFocused: true, lastKey: ready.now - 1000 })).toBe(false);
    expect(wordThiefReady({ ...ready, composerFocused: true, lastKey: ready.now - WORD_TYPING_MS })).toBe(true);
  });
  it('waits 2.5 min between thefts', () => {
    expect(wordThiefReady({ ...ready, lastEnd: ready.now - WORD_COOLDOWN_MS + 1 })).toBe(false);
    expect(wordThiefReady({ ...ready, lastEnd: ready.now - WORD_COOLDOWN_MS })).toBe(true);
  });
  it('ignores pointer jitter', () => {
    expect(movedEnough(2, 2)).toBe(false);
    expect(movedEnough(10, 0)).toBe(true);
  });
});
