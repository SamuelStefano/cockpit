import { describe, it, expect } from 'vitest';
import { isApple, keyLabel, comboLabel } from './platform';

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
