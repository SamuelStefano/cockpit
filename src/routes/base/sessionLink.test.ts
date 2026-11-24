import { describe, expect, it } from 'vitest';
import { parseSessionParam, withSessionParam } from './sessionLink';

describe('parseSessionParam', () => {
  it('accepts ids made of word characters and dashes only', () => {
    expect(parseSessionParam('?session=abc-123_X')).toBe('abc-123_X');
    expect(parseSessionParam('?session=')).toBeNull();
    expect(parseSessionParam('?session=a/b')).toBeNull();
    expect(parseSessionParam('?session=a%20b')).toBeNull();
    expect(parseSessionParam(`?session=${'a'.repeat(81)}`)).toBeNull();
    expect(parseSessionParam('')).toBeNull();
  });
});

describe('withSessionParam', () => {
  it('sets and removes the param without touching the rest', () => {
    expect(withSessionParam('https://x.dev/base?a=1#h', 's-1')).toBe('/base?a=1&session=s-1#h');
    expect(withSessionParam('https://x.dev/base?session=s-1', null)).toBe('/base');
    expect(withSessionParam('https://x.dev/base', 'bad id')).toBe('/base');
  });
});
