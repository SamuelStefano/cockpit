import { describe, expect, it } from 'vitest';
import { defaultDeviceLabel } from './device-label';

describe('defaultDeviceLabel', () => {
  it('names the desktop app instead of Chrome', () => {
    expect(defaultDeviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 deck-desktop/0.1.0 Electron/45.2.1')).toBe('Windows · Deck Desktop');
  });

  it('keeps browser labels', () => {
    expect(defaultDeviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0')).toBe('Windows · Chrome');
  });
});
