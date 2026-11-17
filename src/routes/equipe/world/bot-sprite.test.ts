import { describe, expect, it } from 'vitest';
import { distinctSpriteKeys, sheetFrame, spriteKey, spritePath, textureKey } from './bot-sprite';

describe('spriteKey', () => {
  it('accepts safe keys', () => {
    expect(spriteKey('workers')).toBe('workers');
    expect(spriteKey('a-1')).toBe('a-1');
  });
  it('rejects unsafe or unknown shapes', () => {
    for (const k of ['', '../x', 'a/b', 'A', 'a.png', 'x'.repeat(25), 'urban', 'town', undefined, 3, null]) {
      expect(spriteKey(k)).toBeNull();
    }
  });
  it('builds fixed paths', () => {
    expect(spritePath('/', 'workers')).toBe('/world/workers.png');
    expect(textureKey('workers')).toBe('bot-workers');
  });
});

describe('sheetFrame', () => {
  it('maps 4 facings x 3 rows', () => {
    expect(sheetFrame(0, 'left')).toBe(0);
    expect(sheetFrame(0, 'right')).toBe(3);
    expect(sheetFrame(1, 'down')).toBe(5);
    expect(sheetFrame(2, 'up')).toBe(10);
  });
  it('clamps rows', () => {
    expect(sheetFrame(9, 'left')).toBe(8);
    expect(sheetFrame(-1, 'left')).toBe(0);
  });
});

describe('distinctSpriteKeys', () => {
  it('dedupes and drops invalid', () => {
    expect(distinctSpriteKeys([{ sprite: 'workers' }, { sprite: 'workers' }, { sprite: '../x' }, {}])).toEqual(['workers']);
  });
});
