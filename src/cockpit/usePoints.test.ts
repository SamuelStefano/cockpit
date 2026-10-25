// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePoints } from './usePoints';
import type { ClientMsg } from '../../shared/protocol';

const mudanca = { taskId: 't1', taskName: 'Tarefa', currentPoints: 3, newPoints: 5 };

const montar = (ok = true) => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return ok; });
  return { ...renderHook(() => usePoints(send)), enviados };
};

describe('usePoints', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reivindica o ledger e marca loaded', () => {
    const { result } = montar();
    act(() => { expect(result.current.onMsg({ t: 'points', entries: [], total: 12 })).toBe(true); });
    expect(result.current.pointsTotal).toBe(12);
    expect(result.current.pointsLoaded).toBe(true);
  });

  // O spinner do sync só apaga quando o snapshot chega; sem isso o painel fica
  // "sincronizando…" pra sempre depois de um sync bem-sucedido.
  it('o snapshot encerra o syncing', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'points-dfl-syncing' }); });
    expect(result.current.dflSyncing).toBe(true);
    act(() => { result.current.onMsg({ t: 'points-dfl', snapshot: null }); });
    expect(result.current.dflSyncing).toBe(false);
    expect(result.current.dflLoaded).toBe(true);
  });

  it('claims staged drafts and sends draft ops as frames', () => {
    const { result, enviados } = montar();
    act(() => { expect(result.current.onMsg({ t: 'drafts', items: [{ id: 'ep-1', title: 'E', status: 'draft', createdAt: 0, tasks: [], deliveries: [] }] })).toBe(true); });
    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.draftsLoaded).toBe(true);
    act(() => { expect(result.current.onDraftOp({ op: 'delete-epic', id: 'ep-1' })).toBe(true); });
    expect(enviados.at(-1)).toEqual({ t: 'drafts-op', op: { op: 'delete-epic', id: 'ep-1' } });
  });

  it('resolve a escrita DFL pelo reqId que voltou', async () => {
    const { result, enviados } = montar();
    let p!: Promise<{ ok: boolean; message?: string }>;
    act(() => { p = result.current.onDflChange(mudanca); });
    const enviado = enviados[0] as { t: string; reqId: string };
    expect(enviado.t).toBe('points-dfl-change');
    act(() => { result.current.onMsg({ t: 'points-dfl-write', reqId: enviado.reqId, kind: 'change', ok: true }); });
    await expect(p).resolves.toEqual({ ok: true, message: undefined });
  });

  // Resposta de OUTRA escrita não pode resolver a Promise em espera: o modal
  // fecharia anunciando sucesso de um pedido que nem é o dele.
  it('ignora resposta com reqId alheio', async () => {
    const { result } = montar();
    let p!: Promise<{ ok: boolean; message?: string }>;
    act(() => { p = result.current.onDflChange(mudanca); });
    act(() => { result.current.onMsg({ t: 'points-dfl-write', reqId: 'outro', kind: 'change', ok: true }); });
    let resolvida = false;
    void p.then(() => { resolvida = true; });
    await Promise.resolve();
    expect(resolvida).toBe(false);
    await act(async () => { vi.advanceTimersByTime(65_000); });
    await expect(p).resolves.toEqual({ ok: false, unknown: true, message: 'sem resposta a tempo — pode ter sido gravado' });
  });

  // Sem conexão o frame nem sai: resolver na hora evita o modal travado 65s.
  it('resolve na hora quando o send falha', async () => {
    const { result } = montar(false);
    let p!: Promise<{ ok: boolean; message?: string }>;
    act(() => { p = result.current.onDflInvoice({ deliveryId: 'd', deliveryName: 'D', referenceMonth: '2026-08', pricePerPoint: 75, tasks: [] }); });
    await expect(p).resolves.toEqual({ ok: false, message: 'sem conexão com o backend' });
  });

  // Timeout dispara mesmo com a resposta atrasada; a resposta tardia então não
  // pode reentrar no mapa e resolver de novo (o resolver já foi consumido).
  it('resposta tardia depois do timeout não explode', async () => {
    const { result, enviados } = montar();
    let p!: Promise<{ ok: boolean; message?: string }>;
    act(() => { p = result.current.onDflChange(mudanca); });
    const { reqId } = enviados[0] as { reqId: string };
    await act(async () => { vi.advanceTimersByTime(65_000); });
    await expect(p).resolves.toEqual({ ok: false, unknown: true, message: 'sem resposta a tempo — pode ter sido gravado' });
    act(() => { expect(result.current.onMsg({ t: 'points-dfl-write', reqId, kind: 'change', ok: true })).toBe(true); });
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'notes', text: '' })).toBe(false);
  });
});
