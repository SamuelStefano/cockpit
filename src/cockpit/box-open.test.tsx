// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { boxStore } from './boxes-store';
import { savePref } from '../lib/persist';
import { LAST_SESSION_PREF, openBox, railTargetPath, rememberSession, useRememberLastSession } from './box-open';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const info = (id: string, label: string, online: boolean) => ({ id, label, online, lastSeen: null });

beforeEach(() => { localStorage.clear(); boxStore.reset(); history.replaceState(null, '', '/'); });
afterEach(cleanup);

describe('railTargetPath', () => {
  it('follows the last chat only from the chat view', () => {
    expect(railTargetPath('/c/x', 's1')).toBe('/c/s1');
    expect(railTargetPath('/', 's1')).toBe('/c/s1');
    expect(railTargetPath('/canvas', 's1')).toBeNull();
    expect(railTargetPath('/c/x', undefined)).toBeNull();
  });
});

describe('rememberSession', () => {
  it('ignores drafts and no-ops return the same map', () => {
    const map = { [A]: 's1' };
    expect(rememberSession(map, A, 'new-1')).toBe(map);
    expect(rememberSession(map, A, 's1')).toBe(map);
    expect(rememberSession(map, null, 's2')).toBe(map);
    expect(rememberSession(map, A, 's2')).toEqual({ [A]: 's2' });
  });
});

describe('openBox', () => {
  it('switches box and reopens the last chat of that box', () => {
    const switchBox = vi.fn();
    savePref(LAST_SESSION_PREF, { [B]: 's9' });
    openBox(B, A, switchBox);
    expect(switchBox).toHaveBeenCalledWith(B);
    expect(location.pathname).toBe('/c/s9');
  });

  it('does not redial when it is already the current box', () => {
    const switchBox = vi.fn();
    openBox(A, A, switchBox);
    expect(switchBox).not.toHaveBeenCalled();
  });
});

describe('useRememberLastSession', () => {
  it('remembers the active session of the current box', () => {
    renderHook(() => useRememberLastSession('s3'));
    act(() => { boxStore.setPref(A); boxStore.applyFrame({ t: 'boxes', box: null, primary: A, boxes: [info(A, 'VPS', true)] }); });
    expect(JSON.parse(localStorage.getItem('cockpit.' + LAST_SESSION_PREF) ?? localStorage.getItem(LAST_SESSION_PREF) ?? '{}')).toBeTruthy();
    expect(JSON.stringify(localStorage)).toContain('s3');
  });
});
