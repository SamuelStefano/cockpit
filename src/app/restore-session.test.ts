import { describe, it, expect } from 'vitest';
import { pickRestoredSession } from './restore-session';

const sessions = [{ id: 'A' }, { id: 'C' }];

describe('pickRestoredSession', () => {
  it('returns the URL id when it is known', () => {
    expect(pickRestoredSession({ chatId: 'C', saved: 'A', sessions, archived: [], loading: true })).toBe('C');
  });

  it('waits when the URL id is unknown while loading', () => {
    expect(pickRestoredSession({ chatId: 'B', saved: 'A', sessions, archived: [], loading: true })).toBeNull();
  });

  it('falls back to the saved id when the URL id is unknown after loading', () => {
    expect(pickRestoredSession({ chatId: 'B', saved: 'A', sessions, archived: [], loading: false })).toBe('A');
  });

  it('falls back to the first session when nothing else matches', () => {
    expect(pickRestoredSession({ chatId: '', saved: 'Z', sessions, archived: [], loading: false })).toBe('A');
  });
});
