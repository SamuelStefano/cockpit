import { describe, it, expect } from 'vitest';
import { headingSlug, uniqueHeadingSlug } from './slug';

describe('headingSlug', () => {
  it('lowercases and dasherizes', () => {
    expect(headingSlug('Estado Atual')).toBe('estado-atual');
  });

  it('strips inline markdown markers', () => {
    expect(headingSlug('**Decisões** `firmes`')).toBe('decis-es-firmes');
  });

  it('trims leading/trailing dashes from stripped punctuation', () => {
    expect(headingSlug('## Mapa de arquivos ##')).toBe('mapa-de-arquivos');
  });

  it('falls back to "section" when nothing sluggable remains', () => {
    expect(headingSlug('—')).toBe('section');
  });

  it('is stable for the same text (render and outline must agree)', () => {
    const t = 'Glossário/IDs';
    expect(headingSlug(t)).toBe(headingSlug(t));
  });
});

describe('uniqueHeadingSlug', () => {
  it('suffixes repeats in document order', () => {
    const seen = new Map<string, number>();
    expect(['X', 'Y', 'X', 'X'].map((t) => uniqueHeadingSlug(t, seen))).toEqual(['x', 'y', 'x-2', 'x-3']);
  });
});
