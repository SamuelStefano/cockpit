import { describe, expect, it } from 'vitest';
import type { Session } from '../data/types';
import { nextUnreadBox, nextUnreadSession } from './useUnreadShortcuts';

const list = ['a', 'b', 'c'].map((id) => ({ id }) as Session);

describe('nextUnreadSession', () => {
  it('wraps both ways and skips the open chat', () => {
    expect(nextUnreadSession(list, 'c', new Set(['a']), 1)).toBe('a');
    expect(nextUnreadSession(list, 'a', new Set(['c']), -1)).toBe('c');
    expect(nextUnreadSession(list, 'a', new Set(['a']), 1)).toBeNull();
    expect(nextUnreadSession([], 'a', new Set(), 1)).toBeNull();
  });
});

describe('nextUnreadBox', () => {
  const none = { white: 0, red: 0, locked: false };
  it('finds the next box with something, never the current', () => {
    const byBox = { x: { ...none, red: 1 }, y: none, z: { ...none, white: 1 } };
    expect(nextUnreadBox(['x', 'y', 'z'], 'x', byBox, 1)).toBe('z');
    expect(nextUnreadBox(['x', 'y', 'z'], 'z', byBox, 1)).toBe('x');
    expect(nextUnreadBox(['x'], 'x', { x: { ...none, red: 1 } }, 1)).toBeNull();
    expect(nextUnreadBox([], null, {}, 1)).toBeNull();
  });
});
