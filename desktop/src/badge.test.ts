import { describe, expect, it } from 'vitest';
import { badgeGlyph, renderBadge } from './badge';

describe('badge', () => {
  it('maps counts to glyphs', () => {
    expect(badgeGlyph(0)).toBeNull();
    expect(badgeGlyph(4)).toBe('4');
    expect(badgeGlyph(10)).toBe('+');
  });

  it('draws white digit pixels on a red disc with clear corners', () => {
    const px = renderBadge('1');
    expect(px.length).toBe(16 * 16 * 4);
    expect(px[3]).toBe(0);
    const at = (x: number, y: number) => [...px.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4)];
    expect(at(7, 3)).toEqual([255, 255, 255, 255]);
    expect(at(5, 3)).toEqual([60, 60, 230, 255]);
  });
});
