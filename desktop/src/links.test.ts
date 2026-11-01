import { describe, expect, it } from 'vitest';
import { APP_ORIGIN, canGrantPermission, classifyLink } from './links';

describe('classifyLink', () => {
  it.each([
    [`${APP_ORIGIN}/c/abc`, 'app'],
    ['https://github.com/x', 'external'],
    ['http://example.com', 'external'],
    ['mailto:a@b.c', 'external'],
    ['file:///C:/Windows/System32/calc.exe', 'blocked'],
    ['smb://evil/share', 'blocked'],
    ['ms-msdt:/id', 'blocked'],
    ['javascript:alert(1)', 'blocked'],
    ['deck://b/x/c/y', 'blocked'],
    ['not a url', 'blocked'],
    [`${APP_ORIGIN}.evil.com/`, 'external'],
    ['http://deck.devfellowship.com/', 'external'],
  ])('%s is %s', (url, action) => {
    expect(classifyLink(url)).toBe(action);
  });
});

describe('canGrantPermission', () => {
  it('grants the mic to the main frame of the app only', () => {
    expect(canGrantPermission('media', APP_ORIGIN, true)).toBe(true);
    expect(canGrantPermission('media', APP_ORIGIN, false)).toBe(false);
    expect(canGrantPermission('media', 'https://evil.com', true)).toBe(false);
  });

  it('never grants what the app does not use', () => {
    expect(canGrantPermission('geolocation', APP_ORIGIN, true)).toBe(false);
  });
});
