// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMemories } from './useMemories';
import type { ClientMsg, Memory } from '../../shared/protocol';

const m: Memory = { id: 'm1', title: 'T', body: 'B', agents: [], updatedAt: 1, updatedBy: 'user' };

describe('useMemories', () => {
  it('claims the memories frame and marks loaded', () => {
    const { result } = renderHook(() => useMemories(() => true));
    expect(result.current.memoriesLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'memories', items: [m] })).toBe(true); });
    expect(result.current.memories).toEqual([m]);
    expect(result.current.memoriesLoaded).toBe(true);
    expect(result.current.onMsg({ t: 'team', bots: [] })).toBe(false);
  });

  it('sends list, save and delete frames', () => {
    const sent: ClientMsg[] = [];
    const { result } = renderHook(() => useMemories((x) => { sent.push(x); return true; }));
    act(() => { result.current.onMemList(); result.current.onMemSave({ title: 'T', body: '', agents: [] }); result.current.onMemDelete('m1'); });
    expect(sent.map((x) => x.t)).toEqual(['mem-list', 'mem-save', 'mem-delete']);
  });
});
