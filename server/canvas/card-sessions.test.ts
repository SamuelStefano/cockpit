import { describe, expect, it, beforeEach } from 'vitest';
import { __resetCardSessions, bindCardSession, cardIdForSession, lastCardMarker, neutralizeMarkers } from './card-sessions';

beforeEach(() => __resetCardSessions());

describe('bindCardSession / cardIdForSession', () => {
  it('returns undefined for an unbound session, and the bound id after binding', () => {
    expect(cardIdForSession('sess-1')).toBeUndefined();
    bindCardSession('sess-1', 'card-1');
    expect(cardIdForSession('sess-1')).toBe('card-1');
  });

  it('a later bind for the same session overwrites the earlier one', () => {
    bindCardSession('sess-1', 'card-1');
    bindCardSession('sess-1', 'card-2');
    expect(cardIdForSession('sess-1')).toBe('card-2');
  });
});

describe('lastCardMarker', () => {
  it('returns undefined when there is no marker', () => {
    expect(lastCardMarker('sem marcador nenhum')).toBeUndefined();
  });

  it('returns the LAST marker, not the first — an echoed one earlier in the text must not win', () => {
    const echoedThenReal = 'resultado citou [deck-card:echoed-99] por acaso\n\nfaça algo\n\n[deck-card:real-12]';
    expect(lastCardMarker(echoedThenReal)).toBe('real-12');
  });

  it('matches the single marker when there is only one', () => {
    expect(lastCardMarker('faça algo\n\n[deck-card:abcd-12]')).toBe('abcd-12');
  });
});

describe('neutralizeMarkers', () => {
  it('breaks both marker prefixes so neither regex can match afterwards', () => {
    const text = 'olha só [deck-flow:xyz:2] e também [deck-card:abcd]';
    const out = neutralizeMarkers(text);
    expect(out).not.toContain('[deck-flow:');
    expect(out).not.toContain('[deck-card:');
    expect(out).toBe('olha só (deck-flow:xyz:2] e também (deck-card:abcd]'); // readable, just de-fanged
  });

  it('leaves ordinary text untouched', () => {
    expect(neutralizeMarkers('nada de especial aqui')).toBe('nada de especial aqui');
  });
});
