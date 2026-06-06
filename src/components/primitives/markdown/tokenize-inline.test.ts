import { describe, it, expect } from 'vitest';
import { tokenizeInline } from './tokenize-inline';

describe('tokenizeInline', () => {
  it('returns a single text token for plain prose', () => {
    expect(tokenizeInline('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('splits text around a bold span', () => {
    expect(tokenizeInline('a **b** c')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'bold', value: 'b' },
      { type: 'text', value: ' c' },
    ]);
  });

  it('recognizes italic, strike, code, and wikilink', () => {
    expect(tokenizeInline('*i* ~~s~~ `c` [[w]]')).toEqual([
      { type: 'italic', value: 'i' },
      { type: 'text', value: ' ' },
      { type: 'strike', value: 's' },
      { type: 'text', value: ' ' },
      { type: 'code', value: 'c' },
      { type: 'text', value: ' ' },
      { type: 'wikilink', value: 'w' },
    ]);
  });

  it('parses a markdown link into label and url', () => {
    expect(tokenizeInline('[txt](http://x.com)')).toEqual([
      { type: 'link', label: 'txt', url: 'http://x.com' },
    ]);
  });

  it('strips trailing punctuation off a bare url into a trail field', () => {
    expect(tokenizeInline('see https://a.com.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'autolink', url: 'https://a.com', trail: '.' },
    ]);
  });

  it('keeps a bare url whole when there is no trailing punctuation', () => {
    expect(tokenizeInline('https://a.com/p')).toEqual([
      { type: 'autolink', url: 'https://a.com/p', trail: '' },
    ]);
  });

  it('does not treat snake_case or a lone asterisk as emphasis', () => {
    expect(tokenizeInline('a_b c * d')).toEqual([{ type: 'text', value: 'a_b c * d' }]);
  });
});
