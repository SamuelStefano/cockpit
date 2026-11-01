// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { boxUnreadStore, loadSeen, saveSeen, seenPrefKey, totalRed, unreadLevels } from './box-unread';
import { savePref } from '../lib/persist';

const none = new Set<string>();

beforeEach(() => { localStorage.clear(); boxUnreadStore.reset(); });

describe('unreadLevels', () => {
  it('a finished turn is white, a failed one is red', () => {
    const seen = { a: 1, b: 1 };
    expect(unreadLevels([{ id: 'a', mtime: 2 }, { id: 'b', mtime: 2, lastTurnOk: false }], seen, '', none, none)).toEqual({ white: 1, red: 1 });
  });

  it('a question is red even with nothing newer, unless dismissed', () => {
    const s = [{ id: 'a', mtime: 1, waiting: true }];
    expect(unreadLevels(s, { a: 1 }, '', none, none).red).toBe(1);
    expect(unreadLevels(s, { a: 1 }, '', none, new Set(['a'])).red).toBe(0);
  });

  it('skips the open chat and a running turn', () => {
    expect(unreadLevels([{ id: 'a', mtime: 2, waiting: true }], { a: 1 }, 'a', none, none)).toEqual({ white: 0, red: 0 });
    expect(unreadLevels([{ id: 'a', mtime: 2, waiting: true }], { a: 1 }, '', new Set(['a']), none)).toEqual({ white: 0, red: 0 });
  });

  it('a session first seen now does not flood with dots', () => {
    expect(unreadLevels([{ id: 'a', mtime: 9 }], {}, '', none, none)).toEqual({ white: 0, red: 0 });
  });
});

describe('seen per box', () => {
  it('keeps each box apart and starts from the old shared map', () => {
    savePref('seen', { old: 1 });
    expect(loadSeen('b1')).toEqual({ old: 1 });
    saveSeen('b1', { a: 2 });
    saveSeen('b2', { c: 3 });
    expect(loadSeen('b1')).toEqual({ a: 2 });
    expect(loadSeen('b2')).toEqual({ c: 3 });
    expect(seenPrefKey(null)).toBe('seen');
  });
});

describe('boxUnreadStore', () => {
  it('totals red and drops boxes no longer watched', () => {
    boxUnreadStore.set('a', { white: 1, red: 2, locked: false });
    boxUnreadStore.set('b', { white: 0, red: 1, locked: false });
    expect(totalRed(boxUnreadStore.get())).toBe(3);
    boxUnreadStore.retain(new Set(['b']));
    expect(totalRed(boxUnreadStore.get())).toBe(1);
  });

  it('does not notify when nothing changed', () => {
    const before = boxUnreadStore.get();
    boxUnreadStore.retain(new Set());
    expect(boxUnreadStore.get()).toBe(before);
  });
});
