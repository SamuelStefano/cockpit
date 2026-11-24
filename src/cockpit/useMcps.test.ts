// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMcps } from './useMcps';

const state = { servers: [{ name: 'github', target: 'https://x.example.com/mcp', status: 'connected' as const }] };

describe('useMcps', () => {
  it('sends the get frame and goes busy until the answer lands', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useMcps(send));
    act(() => result.current.onMcpsGet());
    expect(send).toHaveBeenCalledWith({ t: 'mcps-get' });
    expect(result.current.mcpsBusy).toBe(true);
    act(() => { result.current.onMsg({ t: 'mcps', state }); });
    expect(result.current.mcpsBusy).toBe(false);
    expect(result.current.mcps).toEqual(state);
  });

  it('stays idle when the socket is down', () => {
    const { result } = renderHook(() => useMcps(() => false));
    act(() => result.current.onMcpsGet());
    expect(result.current.mcpsBusy).toBe(false);
  });

  it('ignores other frames', () => {
    const { result } = renderHook(() => useMcps(() => true));
    expect(result.current.onMsg({ t: 'admin-op', ok: true, message: 'x' })).toBe(false);
  });
});
