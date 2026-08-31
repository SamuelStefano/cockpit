// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAdmin } from './useAdmin';
import type { ClientMsg, UsageStats } from '../../shared/protocol';

const stats = (totalSamples: number): UsageStats => ({ sessions: [], totalOutput: 0, totalSamples, totalCost: 0, series: [] });

const montar = () => {
  const enviados: ClientMsg[] = [];
  const send = vi.fn((m: ClientMsg) => { enviados.push(m); return true; });
  return { ...renderHook(() => useAdmin(send)), enviados };
};

describe('useAdmin', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // O server manda EMPTY_STATS quando o SQLite está em lock. Sobrescrever com isso
  // apagava um painel já populado a cada snapshot transitório.
  it('snapshot vazio não apaga um painel já populado', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'usage-stats', stats: stats(9) }); });
    act(() => { result.current.onMsg({ t: 'usage-stats', stats: stats(0) }); });
    expect(result.current.usageStats?.totalSamples).toBe(9);
  });

  it('mas o primeiro snapshot vazio entra (é o estado real de quem nunca rodou nada)', () => {
    const { result } = montar();
    act(() => { expect(result.current.onMsg({ t: 'usage-stats', stats: stats(0) })).toBe(true); });
    expect(result.current.usageStats).not.toBe(null);
  });

  // Sem o auto-clear o banner de "salvo"/erro fica preso até a próxima op ou reload.
  it('o banner some sozinho, com erro durando mais que o ok', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'admin-op', ok: true, message: 'salvo' }); });
    act(() => { vi.advanceTimersByTime(3_999); });
    expect(result.current.adminOp?.message).toBe('salvo');
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current.adminOp).toBe(null);

    act(() => { result.current.onMsg({ t: 'admin-op', ok: false, message: 'falhou' }); });
    act(() => { vi.advanceTimersByTime(4_001); });
    expect(result.current.adminOp?.message).toBe('falhou');
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(result.current.adminOp).toBe(null);
  });

  // Timer da op anterior não pode apagar o banner da op nova antes da hora.
  it('op nova reinicia a contagem do banner', () => {
    const { result } = montar();
    act(() => { result.current.onMsg({ t: 'admin-op', ok: true, message: 'a' }); });
    act(() => { vi.advanceTimersByTime(3_500); });
    act(() => { result.current.onMsg({ t: 'admin-op', ok: true, message: 'b' }); });
    act(() => { vi.advanceTimersByTime(3_500); });
    expect(result.current.adminOp?.message).toBe('b');
  });

  // O timer sobrevivia ao unmount e disparava setAdminOp num hook morto.
  it('o timer do banner morre com o hook', () => {
    const { result, unmount } = montar();
    act(() => { result.current.onMsg({ t: 'admin-op', ok: true, message: 'salvo' }); });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accounts marca loaded mesmo vazio', () => {
    const { result } = montar();
    expect(result.current.accountsLoaded).toBe(false);
    act(() => { expect(result.current.onMsg({ t: 'accounts', accounts: [] })).toBe(true); });
    expect(result.current.accountsLoaded).toBe(true);
  });

  it('manda os frames de admin', () => {
    const { result, enviados } = montar();
    act(() => {
      result.current.onUsageList();
      result.current.onHealthList();
      result.current.onAccountsList();
      result.current.onSetAdmin('a1', true);
      result.current.onEnvSet('K', 'V');
      result.current.onEnvUnset('K');
      result.current.onMcpAdd('m', { command: 'cmd' });
      result.current.onMcpRemove('m');
      result.current.onCliInstall('claude');
    });
    expect(enviados).toEqual([
      { t: 'usage-list' },
      { t: 'admin-health' },
      { t: 'accounts-list' },
      { t: 'set-admin', accountId: 'a1', admin: true },
      { t: 'admin-env-set', name: 'K', value: 'V' },
      { t: 'admin-env-unset', name: 'K' },
      { t: 'admin-mcp-add', name: 'm', command: 'cmd', url: undefined },
      { t: 'admin-mcp-remove', name: 'm' },
      { t: 'admin-cli-install', name: 'claude' },
    ]);
  });

  it('devolve false pro que não é dele', () => {
    const { result } = montar();
    expect(result.current.onMsg({ t: 'crons', items: [] })).toBe(false);
  });
});
