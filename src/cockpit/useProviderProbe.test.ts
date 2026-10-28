// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProviderProbe } from './useProviderProbe';

describe('useProviderProbe', () => {
  it('sends the probe, goes busy and takes the answer', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useProviderProbe(send));
    act(() => { result.current.onProviderProbe('https://h/v1', 'k'); });
    expect(send).toHaveBeenCalledWith({ t: 'provider-probe', endpoint: 'https://h/v1', key: 'k' });
    expect(result.current.probeBusy).toBe(true);
    act(() => { result.current.onMsg({ t: 'provider-probe', result: { ok: true, models: [] } }); });
    expect(result.current.probeBusy).toBe(false);
    expect(result.current.probeResult).toEqual({ ok: true, models: [] });
  });
  it('omits the key when empty and reports a dead socket', () => {
    const send = vi.fn(() => false);
    const { result } = renderHook(() => useProviderProbe(send));
    act(() => { result.current.onProviderProbe('https://h/v1'); });
    expect(send).toHaveBeenCalledWith({ t: 'provider-probe', endpoint: 'https://h/v1' });
    expect(result.current.probeResult?.ok).toBe(false);
    expect(result.current.probeBusy).toBe(false);
  });
});
