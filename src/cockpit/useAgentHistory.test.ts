// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ClientMsg } from '../../shared/protocol';
import { useAgentHistory } from './useAgentHistory';

describe('useAgentHistory', () => {
  it('stores logs and diffs and re-reads shown logs after a sync', () => {
    const sent: ClientMsg[] = [];
    const { result } = renderHook(() => useAgentHistory((m) => { sent.push(m); return true; }));
    act(() => result.current.onWsLogGet('atlas1'));
    act(() => { result.current.onMsg({ t: 'team-ws-log', botId: 'atlas1', items: [{ hash: 'abc1234', message: 'm', at: 1, source: 'deck' }], status: { head: 'abc1234' } }); });
    expect(result.current.wsLogs.atlas1).toHaveLength(1);
    act(() => result.current.onWsDiffGet('atlas1', 'abc1234'));
    expect(result.current.wsDiffs['atlas1:abc1234']).toEqual({ status: 'loading' });
    sent.length = 0;
    act(() => { result.current.onMsg({ t: 'team-ws-status', status: { repo: 'demo/deck-agents' }, conflicts: [{ botId: 'atlas1', path: 'CLAUDE.md' }] }); });
    expect(result.current.wsStatus?.repo).toBe('demo/deck-agents');
    expect(result.current.wsConflicts).toHaveLength(1);
    expect(sent).toEqual([{ t: 'team-ws-log-get', botId: 'atlas1' }]);
  });

  it('keeps a restore error and refreshes the file list on success', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useAgentHistory(send));
    act(() => { result.current.onMsg({ t: 'team-ws-restored', botId: 'atlas1', path: 'x.md', ok: false, error: 'caminho inválido' }); });
    expect(result.current.wsError).toBe('caminho inválido');
    act(() => { result.current.onMsg({ t: 'team-ws-restored', botId: 'atlas1', path: 'x.md', ok: true }); });
    expect(send).toHaveBeenCalledWith({ t: 'team-files-get', botId: 'atlas1' });
  });
});
