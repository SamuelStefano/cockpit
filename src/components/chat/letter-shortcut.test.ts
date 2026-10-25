// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { letterIndex, shortcutTargetFree } from './letter-shortcut';

const key = (k: string, over: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat: boolean }> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...over });

describe('letterIndex', () => {
  it('maps a bare A–D press to its option, within the option count', () => {
    expect(letterIndex(key('a'), 4)).toBe(0);
    expect(letterIndex(key('D'), 4)).toBe(3);
    expect(letterIndex(key('d'), 3)).toBe(-1);
  });
  it('ignores modified, repeated and non-letter keys', () => {
    expect(letterIndex(key('a', { ctrlKey: true }), 4)).toBe(-1);
    expect(letterIndex(key('a', { repeat: true }), 4)).toBe(-1);
    expect(letterIndex(key('Enter'), 4)).toBe(-1);
  });
});

describe('shortcutTargetFree', () => {
  it('fires outside text fields', () => {
    expect(shortcutTargetFree(null)).toBe(true);
    expect(shortcutTargetFree(document.createElement('div'))).toBe(true);
  });
  it('never fires inside a text field, even an empty one', () => {
    expect(shortcutTargetFree(document.createElement('textarea'))).toBe(false);
    expect(shortcutTargetFree(document.createElement('input'))).toBe(false);
  });
});
