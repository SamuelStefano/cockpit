import { describe, expect, it } from 'vitest';
import { chunkyIndex, fitsStage } from './find-letter';

describe('find-letter', () => {
  it('prefers a chunky glyph near the middle of the word', () => {
    expect('revisar'[chunkyIndex('revisar')]).not.toMatch(/[ilr]/);
    expect(chunkyIndex('casa')).toBe(2);
  });

  it('rejects glyphs too close to the edges or the bottom', () => {
    const ok = { left: 300, top: 150, width: 9, height: 22 };
    expect(fitsStage(ok, 760, 500, 84)).toBe(true);
    expect(fitsStage({ ...ok, top: 20 }, 760, 500, 84)).toBe(false);
    expect(fitsStage({ ...ok, top: 440 }, 760, 500, 84)).toBe(false);
    expect(fitsStage({ ...ok, left: 30 }, 760, 500, 84)).toBe(false);
  });
});
