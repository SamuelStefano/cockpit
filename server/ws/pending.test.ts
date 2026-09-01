import { describe, it, expect, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import { enqueuePending, hasPending, takePendingBatch, takeAllPending, sameTurnParams, MAX_PENDING, type QueuedSend } from './pending';

const ws = {} as WebSocket;
const item = (prompt: string, extra: Partial<QueuedSend> = {}): QueuedSend => ({ ws, prompt, ...extra });
const drain = (key: string) => { while (takePendingBatch(key)) { /* esvazia */ } };

beforeEach(() => { for (const k of ['s', 'outra']) drain(k); });

describe('enqueuePending', () => {
  it('recusa acima do teto em vez de acumular sem limite', () => {
    for (let i = 0; i < MAX_PENDING; i++) expect(enqueuePending('s', item(`p${i}`))).toBe(true);
    expect(enqueuePending('s', item('estoura'))).toBe(false);
  });

  it('o teto é por sessão', () => {
    for (let i = 0; i < MAX_PENDING; i++) enqueuePending('s', item(`p${i}`));
    expect(enqueuePending('outra', item('p'))).toBe(true);
  });

  it('hasPending só é verdade com item na fila', () => {
    expect(hasPending('s')).toBe(false);
    enqueuePending('s', item('p'));
    expect(hasPending('s')).toBe(true);
    takePendingBatch('s');
    expect(hasPending('s')).toBe(false);
  });
});

describe('takePendingBatch — coalesce', () => {
  it('junta itens consecutivos de mesmos params num turno só', () => {
    enqueuePending('s', item('um'));
    enqueuePending('s', item('dois'));
    expect(takePendingBatch('s')?.text).toBe('um\n\ndois');
    expect(hasPending('s')).toBe(false);
  });

  it('merge enquadra o lote como complemento', () => {
    enqueuePending('s', item('um', { merge: true }));
    enqueuePending('s', item('dois', { merge: true }));
    expect(takePendingBatch('s')?.text).toBe('Complemento do pedido anterior:\n\num\n\ndois');
  });

  it('para o lote na divergência de params e devolve o resto depois', () => {
    enqueuePending('s', item('um'));
    enqueuePending('s', item('dois', { model: 'opus' }));
    expect(takePendingBatch('s')?.text).toBe('um');
    expect(takePendingBatch('s')?.text).toBe('dois');
  });

  // O turno coalescido roda com o esforço do PRIMEIRO item. Sem `effort` na
  // comparação, um prompt enfileirado pedindo esforço alto rodava silenciosamente
  // no esforço do vizinho — e ninguém tinha como perceber.
  it('esforço diferente não coalesce', () => {
    enqueuePending('s', item('rápido', { effort: 'low' }));
    enqueuePending('s', item('pense bem', { effort: 'high' }));
    const primeiro = takePendingBatch('s');
    expect(primeiro?.text).toBe('rápido');
    expect(primeiro?.first.effort).toBe('low');
    expect(takePendingBatch('s')?.first.effort).toBe('high');
  });

  it('fila vazia devolve null', () => {
    expect(takePendingBatch('s')).toBe(null);
  });
});

describe('sameTurnParams', () => {
  it('compara todo param que vai pro startRun', () => {
    const base = item('p', { mode: 'm', model: 'sonnet', maxBudgetUsd: 1, bypass: false, effort: 'low', mcps: ['a'], disallowedSkills: ['x'] });
    expect(sameTurnParams(base, { ...base, prompt: 'outro' })).toBe(true);
    for (const dif of [{ mode: 'z' }, { model: 'opus' }, { maxBudgetUsd: 2 }, { bypass: true }, { effort: 'high' }, { mcps: ['b'] }, { disallowedSkills: [] }, { merge: true }] as Partial<QueuedSend>[]) {
      expect(sameTurnParams(base, { ...base, ...dif })).toBe(false);
    }
  });

  it('msgId não é param de turno e não impede o merge', () => {
    const base = item('p');
    expect(sameTurnParams(base, { ...base, msgId: 'abc' })).toBe(true);
  });
});

describe('takeAllPending', () => {
  it('esvazia a fila de uma vez pra migrar pra estacionada', () => {
    enqueuePending('s', item('um'));
    enqueuePending('s', item('dois', { model: 'opus' }));
    expect(takeAllPending('s').map((i) => i.prompt)).toEqual(['um', 'dois']);
    expect(hasPending('s')).toBe(false);
    expect(takeAllPending('s')).toEqual([]);
  });
});
