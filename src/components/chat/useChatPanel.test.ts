// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatPanel, type Phase } from './useChatPanel';
import type { Session, Message } from '../../data/mock';
import type { ParkedView } from '../../../shared/protocol';

// A fila agora vive no servidor (parked.json). O hook só espelha a prop `queue` e
// delega add/remove/move/clear via callbacks — sem estado local nem drenagem cliente.
function setup(queue: ParkedView[], sessionId = 's1') {
  const queueAdd = vi.fn();
  const queueRemove = vi.fn();
  const queueMove = vi.fn();
  const queueClear = vi.fn();
  const props = {
    session: { id: sessionId } as Session,
    messages: [] as Message[],
    phase: 'thinking' as Phase,
    models: [],
    model: 'opus',
    onSend: vi.fn(),
    queue,
    queueAdd,
    queueRemove,
    queueMove,
    queueClear,
  };
  const hook = renderHook((p: { queue: ParkedView[] }) => useChatPanel({ ...props, queue: p.queue }), {
    initialProps: { queue },
  });
  return { hook, queueAdd, queueRemove, queueMove, queueClear };
}

const pv = (id: string, text: string, at: number, sessionKey = 's1'): ParkedView => ({ sessionKey, id, text, at });

describe('useChatPanel fila (server-backed)', () => {
  it('deriva `queued` da prop queue filtrando pela sessão, na ordem do array (ordem de envio do servidor)', () => {
    const { hook } = setup([
      pv('b', 'segundo', 200),
      pv('a', 'primeiro', 100),
      pv('x', 'outra sessão', 150, 's2'),
    ]);
    expect(hook.result.current.queued).toEqual(['segundo', 'primeiro']);
  });

  it('enqueue delega pro queueAdd (servidor decide a sessão ativa)', () => {
    const { hook, queueAdd } = setup([]);
    hook.result.current.enqueue('novo');
    expect(queueAdd).toHaveBeenCalledWith('novo');
  });

  it('cancelQueueAt remove o item certo por sessionKey+id', () => {
    const { hook, queueRemove } = setup([pv('a', 'primeiro', 100), pv('b', 'segundo', 200)]);
    hook.result.current.cancelQueueAt(1);
    expect(queueRemove).toHaveBeenCalledWith('s1', 'b');
  });

  it('moveQueuedItem move o item certo na direção pedida', () => {
    const { hook, queueMove } = setup([pv('a', 'primeiro', 100), pv('b', 'segundo', 200)]);
    hook.result.current.moveQueuedItem(0, 1);
    expect(queueMove).toHaveBeenCalledWith('s1', 'a', 1);
  });

  it('clearQueue limpa a fila da sessão ativa', () => {
    const { hook, queueClear } = setup([pv('a', 'primeiro', 100)]);
    hook.result.current.clearQueue();
    expect(queueClear).toHaveBeenCalledWith('s1');
  });

  it('sem sessão ativa: queued vazio e clear é no-op', () => {
    const queueClear = vi.fn();
    const hook = renderHook(() => useChatPanel({
      session: null,
      messages: [],
      phase: 'idle',
      models: [],
      model: 'opus',
      onSend: vi.fn(),
      queue: [pv('a', 'x', 100)],
      queueAdd: vi.fn(),
      queueRemove: vi.fn(),
      queueMove: vi.fn(),
      queueClear,
    }));
    expect(hook.result.current.queued).toEqual([]);
    hook.result.current.clearQueue();
    expect(queueClear).not.toHaveBeenCalled();
  });
});
