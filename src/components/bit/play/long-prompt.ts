export const LONG_PROMPT_CHARS = 400;
export const LONG_PROMPT_PAUSE_MS = 2000;
export const LONG_PROMPT_COOLDOWN_MS = 300_000;

export interface LongPromptContext { length: number; now: number; lastKey: number; lastPeek: number; busy: boolean; allowed: boolean }

// A very long prompt and a short breather in the typing: Bit peeks over the composer.
export function shouldPeek(c: LongPromptContext): boolean {
  return c.allowed && !c.busy && c.length >= LONG_PROMPT_CHARS
    && c.now - c.lastKey >= LONG_PROMPT_PAUSE_MS && c.now - c.lastPeek >= LONG_PROMPT_COOLDOWN_MS;
}
