import { describe, it, expect } from 'vitest';
import { clipboardKeyAction } from './useTerminalClipboard';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }> = {}, type = 'keydown') =>
  ({ type, key: k, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods });

describe('clipboardKeyAction', () => {
  it('copies on Ctrl+Shift+C with or without a selection', () => {
    expect(clipboardKeyAction(key('C', { ctrlKey: true, shiftKey: true }), false)).toBe('copy');
    expect(clipboardKeyAction(key('C', { ctrlKey: true, shiftKey: true }), true)).toBe('copy');
  });

  it('copies on Cmd+C', () => {
    expect(clipboardKeyAction(key('c', { metaKey: true }), true)).toBe('copy');
  });

  it('copies on plain Ctrl+C only while text is selected', () => {
    expect(clipboardKeyAction(key('c', { ctrlKey: true }), true)).toBe('copy');
    expect(clipboardKeyAction(key('c', { ctrlKey: true }), false)).toBeNull();
  });

  it('pastes on Ctrl+Shift+V', () => {
    expect(clipboardKeyAction(key('V', { ctrlKey: true, shiftKey: true }), false)).toBe('paste');
  });

  it('pastes on plain Ctrl+V', () => {
    expect(clipboardKeyAction(key('v', { ctrlKey: true }), false)).toBe('paste');
  });

  it('leaves Cmd+V to the native paste event', () => {
    expect(clipboardKeyAction(key('v', { metaKey: true }), false)).toBeNull();
  });

  it('ignores keyup, Alt combos and unrelated keys', () => {
    expect(clipboardKeyAction(key('C', { ctrlKey: true, shiftKey: true }, 'keyup'), true)).toBeNull();
    expect(clipboardKeyAction(key('c', { ctrlKey: true, altKey: true }), true)).toBeNull();
    expect(clipboardKeyAction(key('a', { ctrlKey: true }), true)).toBeNull();
  });
});
