import { describe, expect, it } from 'vitest';
import { deckLinkFromArgv, parseDeckLink } from './deep-link';

describe('parseDeckLink', () => {
  it('reads both forms', () => {
    expect(parseDeckLink('deck://c/abc-1')).toEqual({ box: null, session: 'abc-1' });
    expect(parseDeckLink('deck://b/box1/c/abc')).toEqual({ box: 'box1', session: 'abc' });
  });

  it.each([
    'https://x.com/c/a',
    'deck://enroll/123',
    'deck://c/a?code=1',
    'deck://c/a#enroll=1',
    'deck://c/../../x',
    'deck://u:p@c/a',
    'deck://b/box/c/a/b',
    `deck://c/${'a'.repeat(600)}`,
  ])('rejects %s', (raw) => {
    expect(parseDeckLink(raw)).toBeNull();
  });
});

describe('deckLinkFromArgv', () => {
  it('finds the link among launch arguments', () => {
    expect(deckLinkFromArgv(['Deck.exe', '--hidden', 'deck://c/a'])?.session).toBe('a');
    expect(deckLinkFromArgv(['Deck.exe'])).toBeNull();
  });
});
