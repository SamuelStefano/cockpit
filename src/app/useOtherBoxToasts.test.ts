// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { IDLE_PEEK } from '../cockpit/box-peek';
import { turnTarget, turnTitle } from './useOtherBoxToasts';

const session = { id: 's1', title: 'Rail', relative: '', snippet: '', mtime: 1, count: 1, waiting: false };

describe('other-box turn toasts', () => {
  it('titles by session id, then key, and is empty before the list arrives', () => {
    const state = { ...IDLE_PEEK, sessions: [session] };
    expect(turnTitle(state, { sessionKey: 'k', sessionId: 's1', ok: true })).toBe('Rail');
    expect(turnTitle(state, { sessionKey: 's1', sessionId: '', ok: true })).toBe('Rail');
    expect(turnTitle(undefined, { sessionKey: 's1', sessionId: 's1', ok: true })).toBe('');
  });

  it('never targets a provisional new- key', () => {
    expect(turnTarget({ sessionKey: 'new-1', sessionId: '', ok: false })).toBeNull();
    expect(turnTarget({ sessionKey: 'new-1', sessionId: 's1', ok: true })).toBe('s1');
    expect(turnTarget({ sessionKey: 's2', sessionId: '', ok: true })).toBe('s2');
  });
});
