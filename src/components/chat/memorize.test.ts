import { describe, expect, it } from 'vitest';
import { memorizePrompt } from './memorize';

describe('memorizePrompt', () => {
  it('quotes every line of the message', () => {
    const p = memorizePrompt('first\nsecond');
    expect(p).toContain('> first\n> second');
  });

  it('asks to update an existing memory before creating one', () => {
    expect(memorizePrompt('x')).toMatch(/memory\/.*atualize em vez de duplicar/);
  });

  it('clips very long messages', () => {
    const p = memorizePrompt('a'.repeat(10_000));
    expect(p.length).toBeLessThan(4_500);
    expect(p.endsWith('…')).toBe(true);
  });
});
