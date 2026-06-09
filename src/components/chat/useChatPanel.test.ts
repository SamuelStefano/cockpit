// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChatPanel, type Phase } from './useChatPanel';
import type { Session, Message } from '../../data/mock';

// A fila agora persiste por sessão em localStorage; limpa entre casos pra isolar.
beforeEach(() => localStorage.clear());

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

  it('moveQueuedItem reordena (sobe/desce) e ignora as bordas', () => {
    const { hook } = setup('thinking');
    act(() => hook.result.current.enqueue('a'));
    act(() => hook.result.current.enqueue('b'));
    act(() => hook.result.current.enqueue('c'));
    act(() => hook.result.current.moveQueuedItem(2, -1)); // c sobe
    expect(hook.result.current.queued).toEqual(['a', 'c', 'b']);
    act(() => hook.result.current.moveQueuedItem(0, -1)); // topo não sobe
    expect(hook.result.current.queued).toEqual(['a', 'c', 'b']);
  });

  it('persiste a fila por sessão: trocar de sessão e voltar não perde itens', () => {
    const onSend = vi.fn();
    const base = { messages: [] as Message[], phase: 'thinking' as Phase, models: [], model: 'opus', onSend };
    const hook = renderHook((p: { session: Session }) => useChatPanel({ ...base, session: p.session }), {
      initialProps: { session: { id: 's1' } as Session },
    });
    act(() => hook.result.current.enqueue('na s1'));
    act(() => hook.rerender({ session: { id: 's2' } as Session }));
    expect(hook.result.current.queued).toEqual([]); // s2 tem fila própria
    act(() => hook.rerender({ session: { id: 's1' } as Session }));
    expect(hook.result.current.queued).toEqual(['na s1']); // s1 preservada
  });
});
