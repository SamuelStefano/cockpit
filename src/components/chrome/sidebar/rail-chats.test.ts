import { describe, it, expect } from 'vitest';
import type { Session } from '../../../data/types';
import { railChats, railInitial, railTint } from './rail-chats';

const s = (id: string, mtime: number): Session => ({ id, title: id, relative: '', snippet: '', mtime, hasTerminal: false, active: false });

describe('railChats', () => {
  const list = [s('a', 1), s('b', 5), s('c', 3), s('d', 4)];
  it('puts busy chats first, then most recent', () => {
    expect(railChats(list, new Set(['a']), 'x').map((x) => x.id)).toEqual(['a', 'b', 'd', 'c']);
  });
  it('caps and keeps the active chat', () => {
    const r = railChats(list, undefined, 'a', 2);
    expect(r.map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('rail tile helpers', () => {
  it('derives a stable tint and an initial', () => {
    expect(railTint('abc')).toBe(railTint('abc'));
    expect(railInitial('  olá mundo')).toBe('O');
    expect(railInitial('---')).toBe('·');
  });
});
