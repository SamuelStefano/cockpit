// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import type { Caps } from '../../shared/protocol';
import { useClientVisibility } from './useClientVisibility';

const setVisibility = (state: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
};
const caps = (clientVisibility?: boolean): Caps => ({ role: 'admin', canBypass: false, clientVisibility });

afterEach(() => { cleanup(); setVisibility('visible'); });

describe('useClientVisibility', () => {
  it('sends nothing to an agent that does not announce support, which would answer "sem permissão"', () => {
    const send = vi.fn(() => true);
    renderHook(() => useClientVisibility(caps(), send));
    setVisibility('hidden');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports on connect, on hide, and asks for the list on show', () => {
    const send = vi.fn(() => true);
    renderHook(() => useClientVisibility(caps(true), send));
    expect(send).toHaveBeenLastCalledWith({ t: 'client-visibility', hidden: false });
    setVisibility('hidden');
    expect(send).toHaveBeenLastCalledWith({ t: 'client-visibility', hidden: true });
    setVisibility('visible');
    expect(send.mock.calls.map((c) => (c as unknown[])[0])).toContainEqual({ t: 'list' });
  });

  it('reports again when a reconnect delivers a new caps object', () => {
    const send = vi.fn(() => true);
    const { rerender } = renderHook(({ c }) => useClientVisibility(c, send), { initialProps: { c: caps(true) } });
    rerender({ c: caps(true) });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
