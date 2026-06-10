import { describe, it, expect } from 'vitest';
import { shouldDropUp, MENU_H } from './menu-flip';

describe('shouldDropUp', () => {
  it('opens downward when there is room below', () => {
    expect(shouldDropUp(100, 800)).toBe(false);
  });

  it('flips up when the menu would clip the viewport bottom', () => {
    expect(shouldDropUp(700, 800)).toBe(true);
  });

  it('treats exactly-enough room as fitting below', () => {
    expect(shouldDropUp(800 - MENU_H, 800)).toBe(false);
  });

  it('respects a custom menu height', () => {
    expect(shouldDropUp(700, 800, 50)).toBe(false);
    expect(shouldDropUp(780, 800, 50)).toBe(true);
  });
});
