// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { AgentHistoryApi } from '../../cockpit/useAgentHistory';
import { WsRepoBar } from './WsRepoBar';
import { wsStatusLine } from './ws-status';

afterEach(cleanup);

const api = (over: Partial<AgentHistoryApi> = {}): AgentHistoryApi => ({
  wsLogs: {}, wsDiffs: {}, wsStatus: null, wsConflicts: [], wsRepos: ['demo/deck-agents', 'demo/web'], wsError: null,
  onWsLogGet: vi.fn(), onWsDiffGet: vi.fn(), onWsRestore: vi.fn(), onWsSync: vi.fn(), onWsReposGet: vi.fn(), onWsConnect: vi.fn(),
  ...over,
});

describe('WsRepoBar', () => {
  it('formats the status line', () => {
    const now = 10 * 3_600_000;
    expect(wsStatusLine(null, now)).toBe('Só local');
    expect(wsStatusLine({ repo: 'demo/deck-agents', head: 'a1b2c3d', at: now - 2 * 3_600_000 }, now)).toBe('demo/deck-agents · a1b2c3d · há 2 h');
  });

  it('connects a repo the app can reach', () => {
    const a = api();
    const r = render(<WsRepoBar botId="atlas1" api={a} isAdmin now={0} />);
    fireEvent.click(r.getByText('Conectar GitHub'));
    expect(a.onWsReposGet).toHaveBeenCalled();
    fireEvent.click(r.getByText('Conectar e fazer o primeiro commit'));
    expect(a.onWsConnect).toHaveBeenCalledWith('demo/deck-agents');
  });

  it('syncs and shows this bot\'s conflicts; a student only sees the status', () => {
    const a = api({ wsStatus: { repo: 'demo/deck-agents' }, wsConflicts: [{ botId: 'atlas1', path: 'CLAUDE.md' }, { botId: 'pixel1', path: 'x.md' }] });
    const r = render(<WsRepoBar botId="atlas1" api={a} isAdmin now={0} />);
    fireEvent.click(r.getByText('Sincronizar'));
    expect(a.onWsSync).toHaveBeenCalled();
    expect(r.getAllByRole('status')).toHaveLength(1);
    expect(r.getByRole('status').textContent).toContain('Conflito em CLAUDE.md');
    cleanup();
    const s = render(<WsRepoBar botId="atlas1" api={a} isAdmin={false} now={0} />);
    expect(s.queryByText('Sincronizar')).toBeNull();
    expect(s.queryByText('Conectar GitHub')).toBeNull();
  });
});
