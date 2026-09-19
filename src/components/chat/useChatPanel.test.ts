// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatPanel, type Phase } from './useChatPanel';
import type { Session, Message } from '../../data/types';
import type { QueueItem } from '../../useCockpit';

// A fila agora vive no servidor (parked.json). O hook só espelha a prop `queue` e
// delega add/remove/move/clear via callbacks — sem estado local nem drenagem cliente.
function setup(queue: QueueItem[], sessionId = 's1') {
  const queueAdd = vi.fn();
  const queueRemove = vi.fn();
  const queueEdit = vi.fn();
  const queueMove = vi.fn();
  const queueClear = vi.fn();
  const queueRetry = vi.fn();
  const queueRunBg = vi.fn();
  const queueRunNow = vi.fn();
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
    queueEdit,
    queueMove,
    queueClear,
    queueRetry,
    queueRunBg,
    queueRunNow,
  };
  const hook = renderHook((p: { queue: QueueItem[] }) => useChatPanel({ ...props, queue: p.queue }), {
    initialProps: { queue },
  });
  return { hook, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queueRetry, queueRunBg, queueRunNow };
}

const pv = (id: string, text: string, at: number, sessionKey = 's1'): QueueItem => ({ sessionKey, key: sessionKey, id, text, at });
// Item enfileirado antes de a sessão ganhar id real: o servidor o guarda sob
// `new-xxx` pra sempre, e o display já migrou pro sessionId.
const migrated = (id: string, text: string, at: number, key: string): QueueItem => ({ sessionKey: 'new-abc', key, id, text, at });

describe('useChatPanel fila (server-backed)', () => {
  it('deriva `queued` da prop queue filtrando pela sessão, na ordem do array (ordem de envio do servidor)', () => {
    const { hook } = setup([
      pv('b', 'segundo', 200),
      pv('a', 'primeiro', 100),
      pv('x', 'outra sessão', 150, 's2'),
    ]);
    expect(hook.result.current.queued).toEqual(['segundo', 'primeiro']);
  });

  // Bug do Samuel: com 2+ itens na fila, furar a fila fecha um turno, a sessão
  // migra de `new-xxx` pro sessionId real e o resto da fila sumia da tela.
  it('mostra o item guardado sob a chave pré-migração e escreve de volta na chave do fio', () => {
    const { hook, queueRunNow } = setup([
      migrated('a', 'primeiro', 100, 's1'),
      migrated('b', 'segundo', 200, 's1'),
    ]);
    expect(hook.result.current.queued).toEqual(['primeiro', 'segundo']);
    hook.result.current.runQueuedNowAt(1);
    expect(queueRunNow).toHaveBeenCalledWith('new-abc', 'b');
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

  it('editQueuedAt reescreve o item certo por sessionKey+id', () => {
    const { hook, queueEdit } = setup([pv('a', 'primeiro', 100), pv('b', 'segundo', 200)]);
    hook.result.current.editQueuedAt(1, '  segundo corrigido  ');
    expect(queueEdit).toHaveBeenCalledWith('s1', 'b', 'segundo corrigido');
  });

  it('editQueuedAt preserva os anexos amarrados ao item (edita só o corpo)', () => {
    const { hook, queueEdit } = setup([pv('a', '[anexo: /tmp/x-y-foto.png]\n\ntexto velho', 100)]);
    expect(hook.result.current.queued).toEqual(['texto velho']);
    hook.result.current.editQueuedAt(0, 'texto novo');
    expect(queueEdit).toHaveBeenCalledWith('s1', 'a', '[anexo: /tmp/x-y-foto.png]\n\ntexto novo');
  });

  it('editQueuedAt ignora texto vazio (esvaziar não é como cancelar)', () => {
    const { hook, queueEdit } = setup([pv('a', 'primeiro', 100)]);
    hook.result.current.editQueuedAt(0, '   ');
    expect(queueEdit).not.toHaveBeenCalled();
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
      queueEdit: vi.fn(),
      queueMove: vi.fn(),
      queueClear,
      queueRetry: vi.fn(),
      queueRunBg: vi.fn(),
      queueRunNow: vi.fn(),
    }));
    expect(hook.result.current.queued).toEqual([]);
    hook.result.current.clearQueue();
    expect(queueClear).not.toHaveBeenCalled();
  });
});

describe('useChatPanel histórico do composer', () => {
  it('recupera o prompt sem os marcadores de anexo do wire', () => {
    const messages = [
      { id: 'u1', role: 'user', text: '[anexo: attachments/s1/1-ab-foto.png]\nolha isso', ts: 1 },
    ] as unknown as Message[];
    const hook = renderHook(() => useChatPanel({
      session: { id: 's1' } as Session,
      messages,
      phase: 'idle' as Phase,
      models: [],
      model: 'opus',
      onSend: vi.fn(),
      queue: [],
      queueAdd: vi.fn(),
      queueRemove: vi.fn(),
      queueEdit: vi.fn(),
      queueMove: vi.fn(),
      queueClear: vi.fn(),
      queueRetry: vi.fn(),
      queueRunBg: vi.fn(),
      queueRunNow: vi.fn(),
    }));
    expect(hook.result.current.sentHistory).toEqual(['olha isso']);
  });
});
