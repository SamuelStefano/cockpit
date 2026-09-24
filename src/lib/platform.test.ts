import { describe, it, expect } from 'vitest';
import { isApple, keyLabel, comboLabel, isIOS } from './platform';

describe('platform shortcut labels', () => {
  it('detects Apple keyboards', () => {
    expect(isApple('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(true);
    expect(isApple('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isApple('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false);
  });

  it('uses Ctrl/Alt off Apple', () => {
    expect(keyLabel('⌘', false)).toBe('Ctrl');
    expect(keyLabel('⌥', false)).toBe('Alt');
    expect(keyLabel('K', false)).toBe('K');
    expect(comboLabel(['⌘', 'K'], false)).toBe('Ctrl+K');
    expect(comboLabel(['⌘', 'K'], true)).toBe('⌘K');
  });
});

describe('isIOS', () => {
  it('detects iPhone and iPadOS posing as a Mac, not a real Mac', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIOS('Mozilla/5.0 (Linux; Android 14)', 5)).toBe(false);
  });
});
