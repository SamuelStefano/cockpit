import { describe, it, expect } from 'vitest';
import { isWindowsBrowser } from './isWindowsBrowser';

describe('isWindowsBrowser', () => {
  it('detects via userAgentData.platform', () => {
    expect(isWindowsBrowser({ userAgentData: { platform: 'Windows' } })).toBe(true);
    expect(isWindowsBrowser({ userAgentData: { platform: 'Linux' }, userAgent: 'Windows' })).toBe(false);
  });
  it('falls back to the user agent', () => {
    expect(isWindowsBrowser({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe(true);
    expect(isWindowsBrowser({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe(false);
    expect(isWindowsBrowser({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' })).toBe(false);
  });
  it('is false without a navigator', () => {
    expect(isWindowsBrowser({})).toBe(false);
  });
});
