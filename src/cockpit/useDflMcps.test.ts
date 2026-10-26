// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDflMcps } from './useDflMcps';

const state = { hosts: [], source: 'manifest' as const };

describe('useDflMcps', () => {
  it('sends get/add frames and goes busy until the answer lands', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useDflMcps(send));
    act(() => result.current.onDflMcpsGet());
    expect(send).toHaveBeenCalledWith({ t: 'dfl-mcps-get' });
    expect(result.current.dflMcpsBusy).toBe(true);
    act(() => { result.current.onMsg({ t: 'dfl-mcps', state }); });
    expect(result.current.dflMcpsBusy).toBe(false);
    expect(result.current.dflMcps).toEqual(state);
    act(() => result.current.onDflMcpsAdd(['work']));
    expect(send).toHaveBeenLastCalledWith({ t: 'dfl-mcps-add', hosts: ['work'] });
  });

  it('stays idle when the socket is down', () => {
    const { result } = renderHook(() => useDflMcps(() => false));
    act(() => result.current.onDflMcpsGet());
    expect(result.current.dflMcpsBusy).toBe(false);
  });

  it('ignores other frames', () => {
    const { result } = renderHook(() => useDflMcps(() => true));
    expect(result.current.onMsg({ t: 'admin-op', ok: true, message: 'x' })).toBe(false);
  });
});
