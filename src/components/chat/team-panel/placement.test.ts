import { describe, expect, it } from 'vitest';
import { panelPlacement } from './placement';

describe('panelPlacement', () => {
  it('is none when closed', () => {
    expect(panelPlacement({ open: false, isMobile: true, hero: true })).toBe('none');
  });
  it('is aside on desktop, hero or not', () => {
    expect(panelPlacement({ open: true, isMobile: false, hero: true })).toBe('aside');
    expect(panelPlacement({ open: true, isMobile: false, hero: false })).toBe('aside');
  });
  it('is drawer on phone in a thread', () => {
    expect(panelPlacement({ open: true, isMobile: true, hero: false })).toBe('drawer');
  });
  it('is hero-drawer on phone in the hero state', () => {
    expect(panelPlacement({ open: true, isMobile: true, hero: true })).toBe('hero-drawer');
  });
});
