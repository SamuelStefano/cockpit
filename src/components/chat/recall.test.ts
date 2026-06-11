import { describe, it, expect } from 'vitest';
import { nextRecall } from './recall';

const H = ['first', 'second', 'third'];

describe('nextRecall', () => {
  it('returns null when there is no history', () => {
    expect(nextRecall([], null, '', 'up')).toBeNull();
    expect(nextRecall([], 2, '', 'down')).toBeNull();
  });

  it('up from idle empty field pulls the last entry', () => {
    expect(nextRecall(H, null, '', 'up')).toEqual({ histIdx: 2, value: 'third' });
  });

  it('up from idle non-empty field falls through (null)', () => {
    expect(nextRecall(H, null, 'typing', 'up')).toBeNull();
  });

  it('up walks backwards and clamps at the top', () => {
    expect(nextRecall(H, 2, 'third', 'up')).toEqual({ histIdx: 1, value: 'second' });
    expect(nextRecall(H, 1, 'second', 'up')).toEqual({ histIdx: 0, value: 'first' });
    expect(nextRecall(H, 0, 'first', 'up')).toEqual({ histIdx: 0, value: 'first' });
  });

  it('down without active recall falls through (null)', () => {
    expect(nextRecall(H, null, '', 'down')).toBeNull();
  });

  it('down walks forward', () => {
    expect(nextRecall(H, 0, 'first', 'down')).toEqual({ histIdx: 1, value: 'second' });
  });

  it('down past the end clears (back to a fresh field)', () => {
    expect(nextRecall(H, 2, 'third', 'down')).toEqual({ histIdx: null, value: '' });
  });

  it('up with a stale index and an empty field restarts at the new tail', () => {
    const shorter = ['only'];
    expect(nextRecall(shorter, 5, '', 'up')).toEqual({ histIdx: 0, value: 'only' });
  });

  it('up with a stale index but a non-empty field falls through (protects the draft)', () => {
    const shorter = ['only'];
    expect(nextRecall(shorter, 5, 'draft da sessão nova', 'up')).toBeNull();
  });

  it('down with a stale out-of-range index falls through instead of indexing past the end', () => {
    const shorter = ['only'];
    expect(nextRecall(shorter, 5, 'leftover', 'down')).toBeNull();
  });
});
