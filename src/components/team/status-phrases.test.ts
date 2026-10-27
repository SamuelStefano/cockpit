import { describe, it, expect } from 'vitest';
import { phraseAt, STATUS_PHRASES, PHRASE_MS } from './status-phrases';

describe('phraseAt', () => {
  it('starts on the first phrase and advances every 4s', () => {
    expect(phraseAt(0)).toBe('Pensando…');
    expect(phraseAt(PHRASE_MS - 1)).toBe('Pensando…');
    expect(phraseAt(PHRASE_MS)).toBe('Ponderando…');
    expect(phraseAt(PHRASE_MS * 4)).toBe('Escrevendo…');
  });
  it('wraps around and tolerates clock skew', () => {
    expect(phraseAt(PHRASE_MS * STATUS_PHRASES.length)).toBe('Pensando…');
    expect(phraseAt(-500)).toBe('Pensando…');
  });
});
