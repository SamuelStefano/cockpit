// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnections } from './useConnections';

describe('useConnections', () => {
  it('asks for the list and stores the frame', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useConnections(send));
    expect(result.current.loaded).toBe(false);
    act(() => result.current.refresh());
    expect(send).toHaveBeenCalledWith({ t: 'connections-get' });
    let claimed = false;
    act(() => { claimed = result.current.onMsg({ t: 'connections', items: [{ id: 'a', kind: 'tool', label: 'A', state: 'connected' }] }); });
    expect(claimed).toBe(true);
    expect(result.current.loaded).toBe(true);
    expect(result.current.connections).toHaveLength(1);
  });

  it('ignores other frames', () => {
    const { result } = renderHook(() => useConnections(() => true));
    expect(result.current.onMsg({ t: 'mcps', state: { servers: [] } } as never)).toBe(false);
  });
});
