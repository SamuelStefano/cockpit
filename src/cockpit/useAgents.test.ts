// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAgents } from './useAgents';

const draft = { id: 'mine', name: 'Mine', command: 'mine', args: ['acp'], install: 'npm i -g mine' };

describe('useAgents custom agent', () => {
  it('sends the save with setup commands and tracks it until the server answers', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useAgents(send));
    act(() => { result.current.agents.addCustom(draft); });
    expect(send).toHaveBeenCalledWith({ t: 'agent-add-custom', ...draft });
    expect(result.current.agents.customBusy).toBe('save');
    act(() => { result.current.onMsg({ t: 'agent-custom-result', ok: false, message: 'não', field: 'command' }); });
    expect(result.current.agents.customBusy).toBeNull();
    expect(result.current.agents.customOutcome).toEqual({ kind: 'save', ok: false, message: 'não', field: 'command' });
  });

  it('probes a draft without its setup commands', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useAgents(send));
    act(() => { result.current.agents.probeDraft(draft); });
    expect(send).toHaveBeenCalledWith({ t: 'agent-probe-draft', id: 'mine', name: 'Mine', command: 'mine', args: ['acp'] });
    act(() => { result.current.onMsg({ t: 'agent-draft-result', ok: true, status: 'ready', message: 'ok' }); });
    expect(result.current.agents.customOutcome).toMatchObject({ kind: 'probe', ok: true, status: 'ready' });
  });

  it('stays idle when the socket is closed', () => {
    const { result } = renderHook(() => useAgents(() => false));
    act(() => { expect(result.current.agents.addCustom(draft)).toBe(false); });
    expect(result.current.agents.customBusy).toBeNull();
  });
});
