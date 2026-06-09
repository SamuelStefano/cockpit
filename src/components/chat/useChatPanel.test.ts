// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChatPanel, type Phase } from './useChatPanel';
import type { Session, Message } from '../../data/mock';

function setup(initialPhase: Phase, onSend = vi.fn()) {
  const props = {
    session: { id: 's1' } as Session,
    messages: [] as Message[],
    phase: initialPhase,
    models: [],
    model: 'opus',
    onSend,
  };
  const hook = renderHook((p: { phase: Phase }) => useChatPanel({ ...props, phase: p.phase }), {
    initialProps: { phase: initialPhase },
  });
  return { hook, onSend };
}

describe('useChatPanel fila', () => {
  it('acumula múltiplas mensagens em vez de sobrescrever (não perde a 1ª)', () => {
    const { hook } = setup('thinking');
    act(() => hook.result.current.enqueue('msg1'));
    act(() => hook.result.current.enqueue('msg2'));
    expect(hook.result.current.queued).toEqual(['msg1', 'msg2']);
  });

  it('dispara UMA por vez, em ordem, a cada transição pra idle', () => {
    const { hook, onSend } = setup('thinking');
    act(() => hook.result.current.enqueue('msg1'));
    act(() => hook.result.current.enqueue('msg2'));

    // Turno termina → libera só a 1ª.
    act(() => hook.rerender({ phase: 'idle' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenLastCalledWith('msg1');
    expect(hook.result.current.queued).toEqual(['msg2']);

    // Novo turno começa (msg1 rodando) e termina → libera a 2ª.
    act(() => hook.rerender({ phase: 'thinking' }));
    act(() => hook.rerender({ phase: 'idle' }));
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(onSend).toHaveBeenLastCalledWith('msg2');
    expect(hook.result.current.queued).toEqual([]);
  });

  it('cancelQueueAt remove só o item indicado', () => {
    const { hook } = setup('thinking');
    act(() => hook.result.current.enqueue('a'));
    act(() => hook.result.current.enqueue('b'));
    act(() => hook.result.current.enqueue('c'));
    act(() => hook.result.current.cancelQueueAt(1));
    expect(hook.result.current.queued).toEqual(['a', 'c']);
  });
});
