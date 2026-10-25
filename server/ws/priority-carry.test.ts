import { describe, it, expect } from 'vitest';
import { cardMarker, flowMarker } from '../../shared/canvas';
import { CARRY_PROMPT_CHARS, carriedPrompt, priorityCarry } from './priority-carry';

describe('carriedPrompt', () => {
  it('keeps a short prompt whole', () => {
    expect(carriedPrompt('faz x', true)).toBe('faz x');
  });

  it('keeps the whole prompt when there is no transcript to resume', () => {
    const long = 'a'.repeat(5000);
    expect(carriedPrompt(long, false)).toBe(long);
  });

  it('cuts a long prompt to a pointer when resuming', () => {
    const out = carriedPrompt('a'.repeat(100_000), true);
    expect(out.length).toBe(CARRY_PROMPT_CHARS + 1);
  });

  it('keeps the card and flow markers that sat in the cut tail', () => {
    const tail = `${cardMarker('card-1234')}\n\n${flowMarker('flow-abcd', 3)}`;
    const out = carriedPrompt(`${'a'.repeat(5000)}\n${tail}`, true);
    expect(out).toContain(cardMarker('card-1234'));
    expect(out).toContain(flowMarker('flow-abcd', 3));
  });

  it('keeps a marker split by the cut', () => {
    const marker = cardMarker('card-5678');
    const out = carriedPrompt(`${'a'.repeat(CARRY_PROMPT_CHARS - 5)}${marker}${'b'.repeat(100)}`, true);
    expect(out).toContain(marker);
  });
});

describe('priorityCarry', () => {
  it('sends the new prompt alone when the interrupted turn produced nothing', () => {
    expect(priorityCarry({ prompt: 'old', text: '', thinking: '' }, 'new', true)).toBe('new');
  });

  it('carries the partial progress and ends with the urgent instruction', () => {
    const out = priorityCarry({ prompt: 'old', text: 'half done', thinking: 'plan' }, 'new', true);
    expect(out).toContain('Você estava no meio de: old');
    expect(out).toContain('half done');
    expect(out.endsWith('NOVA INSTRUÇÃO URGENTE (priorize):\nnew')).toBe(true);
  });
});
