// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVersions } from './useVersions';

const item = { version: '1700000000000-abcdef12', ts: 1_700_000_000_000, bytes: 10, deleted: false };

describe('useVersions', () => {
  it('opens an item, loads the list and ignores other kinds', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useVersions(send, 'skill'));
    act(() => result.current.api.open('demo'));
    expect(send).toHaveBeenCalledWith({ t: 'versions-list', kind: 'skill', id: 'demo' });
    expect(result.current.api.loading).toBe(true);
    let handled = false;
    act(() => { handled = result.current.onMsg({ t: 'versions', kind: 'agent', id: 'demo', items: [item] }); });
    expect(handled).toBe(false);
    act(() => { result.current.onMsg({ t: 'versions', kind: 'skill', id: 'demo', items: [item] }); });
    expect(result.current.api.items).toEqual([item]);
    expect(result.current.api.loading).toBe(false);
  });

  it('requests a diff and a restore for the open item', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useVersions(send, 'agent'));
    act(() => result.current.api.open('gem'));
    act(() => result.current.api.showDiff('a', 'b'));
    expect(send).toHaveBeenCalledWith({ t: 'versions-diff', kind: 'agent', id: 'gem', from: 'a', to: 'b' });
    act(() => result.current.api.restore('a'));
    expect(send).toHaveBeenCalledWith({ t: 'versions-restore', kind: 'agent', id: 'gem', version: 'a' });
    expect(result.current.api.restoring).toBe(true);
    act(() => { result.current.onMsg({ t: 'versions-restore-result', kind: 'agent', id: 'gem', ok: true, message: 'ok' }); });
    expect(result.current.api.restoring).toBe(false);
  });

  it('stores the diff text for the open item only', () => {
    const { result } = renderHook(() => useVersions(vi.fn(() => true), 'agent'));
    act(() => result.current.api.open('gem'));
    act(() => { result.current.onMsg({ t: 'versions-diff', kind: 'agent', id: 'other', from: 'a', to: 'b', ok: true, diff: 'x' }); });
    expect(result.current.api.diff).toBeNull();
    act(() => { result.current.onMsg({ t: 'versions-diff', kind: 'agent', id: 'gem', from: 'a', to: 'b', ok: true, diff: '+x' }); });
    expect(result.current.api.diff?.text).toBe('+x');
  });
});
