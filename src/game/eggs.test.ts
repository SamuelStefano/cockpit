import { describe, it, expect } from 'vitest';
import { KONAMI, sequenceMatcher, wordMatcher, dayOfYear, isProgrammersDay, isHalloween, isChristmas, isNewYear, isFridayAfternoon, isTypingTarget } from './eggs';

const feed = (m: (k: string) => boolean, keys: string[]) => keys.map(m);

describe('sequenceMatcher', () => {
  it('matches the Konami code once', () => {
    const m = sequenceMatcher(KONAMI);
    const r = feed(m, KONAMI);
    expect(r.at(-1)).toBe(true);
    expect(r.slice(0, -1).some(Boolean)).toBe(false);
  });
  it('survives a repeated prefix (extra ArrowUp first)', () => {
    const m = sequenceMatcher(KONAMI);
    expect(feed(m, ['ArrowUp', ...KONAMI]).at(-1)).toBe(true);
  });
  it('rejects a wrong key in the middle', () => {
    const m = sequenceMatcher(KONAMI);
    const keys = [...KONAMI.slice(0, 5), 'x', ...KONAMI.slice(5)];
    expect(feed(m, keys).some(Boolean)).toBe(false);
  });
  it('can fire again after a match', () => {
    const m = sequenceMatcher(KONAMI);
    feed(m, KONAMI);
    expect(feed(m, KONAMI).at(-1)).toBe(true);
  });
});

describe('wordMatcher', () => {
  it('matches case-insensitively and ignores non-character keys', () => {
    const m = wordMatcher('iddqd');
    expect(feed(m, [...'IDDQD']).at(-1)).toBe(true);
    expect(m('Shift')).toBe(false);
  });
  it('matches inside a longer stream', () => {
    const m = wordMatcher('matrix');
    expect(feed(m, [...'xxmatrix']).at(-1)).toBe(true);
  });
});

describe('date helpers', () => {
  it('finds the 256th day', () => {
    expect(dayOfYear(new Date(2026, 8, 13))).toBe(256);
    expect(isProgrammersDay(new Date(2026, 8, 13))).toBe(true);
    expect(isProgrammersDay(new Date(2028, 8, 12))).toBe(true);
    expect(isProgrammersDay(new Date(2028, 8, 13))).toBe(false);
  });
  it('detects the seasonal days', () => {
    expect(isHalloween(new Date(2026, 9, 31))).toBe(true);
    expect(isHalloween(new Date(2026, 9, 30))).toBe(false);
    expect(isChristmas(new Date(2026, 11, 25))).toBe(true);
    expect(isNewYear(new Date(2027, 0, 1))).toBe(true);
  });
  it('detects Friday from 16:00', () => {
    expect(isFridayAfternoon(new Date(2026, 10, 6, 16, 0))).toBe(true);
    expect(isFridayAfternoon(new Date(2026, 10, 6, 15, 59))).toBe(false);
    expect(isFridayAfternoon(new Date(2026, 10, 5, 17, 0))).toBe(false);
  });
});

describe('isTypingTarget', () => {
  it('flags form fields but not null or plain elements', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
  });
});
