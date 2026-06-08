import { describe, it, expect } from 'vitest';
import { joinTranscript } from './speech';

describe('joinTranscript', () => {
  it('returns the base untouched when nothing was spoken', () => {
    expect(joinTranscript('oi', '')).toBe('oi');
    expect(joinTranscript('oi', '   ')).toBe('oi');
  });

  it('returns the spoken text when the base is empty', () => {
    expect(joinTranscript('', 'manda ver')).toBe('manda ver');
    expect(joinTranscript('  ', 'manda ver')).toBe('manda ver');
  });

  it('joins base and transcript with a single space', () => {
    expect(joinTranscript('escreve', 'um teste')).toBe('escreve um teste');
  });

  it('does not duplicate trailing whitespace from the base', () => {
    expect(joinTranscript('escreve ', 'um teste')).toBe('escreve um teste');
    expect(joinTranscript('escreve\n', 'um teste')).toBe('escreve um teste');
  });

  it('trims the spoken text edges', () => {
    expect(joinTranscript('oi', '  tudo bem  ')).toBe('oi tudo bem');
  });
});
