import { describe, it, expect } from 'vitest';
import { opensNewChat } from './entry-landing';

const now = 10_000_000;
const away = now - 31 * 60_000;
const recent = now - 60_000;

describe('opensNewChat', () => {
  it('opens a new chat when entering at the root', () => {
    expect(opensNewChat({ path: '/', navType: 'navigate', hiddenAt: null, now })).toBe(true);
  });
  it('keeps the chat on a reload', () => {
    expect(opensNewChat({ path: '/c/abc', navType: 'reload', hiddenAt: recent, now })).toBe(false);
    expect(opensNewChat({ path: '/', navType: 'reload', hiddenAt: recent, now })).toBe(false);
  });
  it('keeps the chat of a pasted link', () => {
    expect(opensNewChat({ path: '/c/abc', navType: 'navigate', hiddenAt: null, now })).toBe(false);
  });
  it('opens a new chat when an evicted tab comes back after a long absence', () => {
    expect(opensNewChat({ path: '/c/abc', navType: 'reload', hiddenAt: away, now })).toBe(true);
  });
  it('leaves other routes alone', () => {
    expect(opensNewChat({ path: '/canvas', navType: 'navigate', hiddenAt: away, now })).toBe(false);
  });
});
