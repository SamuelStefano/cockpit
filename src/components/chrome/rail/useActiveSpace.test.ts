// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ALL_SPACE, useActiveSpace } from './useActiveSpace';

const IDS = ['a', 'b'];

describe('useActiveSpace', () => {
  it('starts on every conversation without an active agent', () => {
    const { result } = renderHook(() => useActiveSpace(null, IDS));
    expect(result.current.space).toBe(ALL_SPACE);
    expect(result.current.agentId).toBeNull();
  });

  it('starts on the agent whose thread is open', () => {
    const { result } = renderHook(() => useActiveSpace('a', IDS));
    expect(result.current.agentId).toBe('a');
  });

  it('follows the active agent when it changes to a bot', () => {
    const { result, rerender } = renderHook(({ id }) => useActiveSpace(id, IDS), { initialProps: { id: null as string | null } });
    rerender({ id: 'b' });
    expect(result.current.agentId).toBe('b');
  });

  it('stays on the agent when a plain chat opens', () => {
    const { result, rerender } = renderHook(({ id }) => useActiveSpace(id, IDS), { initialProps: { id: 'a' as string | null } });
    rerender({ id: null });
    expect(result.current.agentId).toBe('a');
  });

  it('switches by hand without the active agent changing', () => {
    const { result } = renderHook(() => useActiveSpace('a', IDS));
    act(() => result.current.selectAll());
    expect(result.current.space).toBe(ALL_SPACE);
    act(() => result.current.selectAgent('b'));
    expect(result.current.agentId).toBe('b');
  });

  it('falls back to every conversation when the agent is gone', () => {
    const { result, rerender } = renderHook(({ ids }) => useActiveSpace('a', ids), { initialProps: { ids: IDS } });
    rerender({ ids: ['b'] });
    expect(result.current.space).toBe(ALL_SPACE);
  });
});
