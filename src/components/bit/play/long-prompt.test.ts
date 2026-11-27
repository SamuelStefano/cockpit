import { describe, it, expect } from 'vitest';
import { shouldPeek, LONG_PROMPT_CHARS, LONG_PROMPT_PAUSE_MS, LONG_PROMPT_COOLDOWN_MS } from './long-prompt';

const ok = { length: LONG_PROMPT_CHARS, now: 1_000_000, lastKey: 1_000_000 - LONG_PROMPT_PAUSE_MS, lastPeek: 0, busy: false, allowed: true };

describe('shouldPeek', () => {
  it('peeks on a long prompt after a pause', () => expect(shouldPeek(ok)).toBe(true));
  it('not for short prompts, mid-typing, busy stage, play off', () => {
    expect(shouldPeek({ ...ok, length: 50 })).toBe(false);
    expect(shouldPeek({ ...ok, lastKey: ok.now - 500 })).toBe(false);
    expect(shouldPeek({ ...ok, busy: true })).toBe(false);
    expect(shouldPeek({ ...ok, allowed: false })).toBe(false);
  });
  it('respects the cooldown', () => {
    expect(shouldPeek({ ...ok, lastPeek: ok.now - LONG_PROMPT_COOLDOWN_MS + 1 })).toBe(false);
    expect(shouldPeek({ ...ok, lastPeek: ok.now - LONG_PROMPT_COOLDOWN_MS })).toBe(true);
  });
});
