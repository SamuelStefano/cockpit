import { describe, expect, it } from 'vitest';
import { trustedSender, validBadgeCount } from './bridge-rules';
import { APP_ORIGIN } from './links';

describe('trustedSender', () => {
  it('accepts only the main frame of the app', () => {
    expect(trustedSender(`${APP_ORIGIN}/c/x`, true)).toBe(true);
    expect(trustedSender(`${APP_ORIGIN}/c/x`, false)).toBe(false);
    expect(trustedSender(`${APP_ORIGIN}/sandbox/frame.html`, true)).toBe(false);
    expect(trustedSender('https://evil.com/', true)).toBe(false);
    expect(trustedSender('file:///offline.html', true)).toBe(false);
  });
});

describe('validBadgeCount', () => {
  it('rejects junk and clamps', () => {
    expect(validBadgeCount('3')).toBeNull();
    expect(validBadgeCount(-1)).toBeNull();
    expect(validBadgeCount(1.5)).toBeNull();
    expect(validBadgeCount(5000)).toBe(999);
  });
});
