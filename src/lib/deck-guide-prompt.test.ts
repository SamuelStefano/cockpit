import { describe, it, expect } from 'vitest';
import { DECK_GUIDE_PROMPT, DECK_GUIDE_SKILL } from './deck-guide-prompt';

describe('DECK_GUIDE_PROMPT', () => {
  it('names the bundled skill so the agent loads it', () => {
    expect(DECK_GUIDE_PROMPT).toContain(DECK_GUIDE_SKILL);
  });
});
