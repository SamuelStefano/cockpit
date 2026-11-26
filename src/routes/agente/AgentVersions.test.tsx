// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { AgentHistoryApi } from '../../cockpit/useAgentHistory';
import { AgentVersions } from './AgentVersions';

afterEach(cleanup);

const h1 = 'a'.repeat(40), h2 = 'b'.repeat(40);
const api = (over: Partial<AgentHistoryApi> = {}): AgentHistoryApi => ({
  wsLogs: { atlas1: [{ hash: h1, message: 'Atlas: CLAUDE.md', at: Date.now() - 3_600_000, source: 'deck' }, { hash: h2, message: 'edit no repo', at: Date.now(), source: 'github' }] },
  wsDiffs: { [`atlas1:${h1}`]: { status: 'ok', files: [{ path: 'CLAUDE.md', old: '# v1', new: '# v2' }] } },
  wsStatus: { head: 'aaaaaaa' }, wsConflicts: [], wsRepos: null, wsError: null,
  onWsLogGet: vi.fn(), onWsDiffGet: vi.fn(), onWsRestore: vi.fn(), onWsSync: vi.fn(), onWsReposGet: vi.fn(), onWsConnect: vi.fn(),
  ...over,
});

describe('AgentVersions', () => {
  it('lists commits, shows the newest diff and restores a file', () => {
    const a = api();
    const r = render(<AgentVersions botId="atlas1" api={a} connected isAdmin />);
    expect(a.onWsLogGet).toHaveBeenCalledWith('atlas1');
    expect(r.getByText('Atlas: CLAUDE.md')).toBeTruthy();
    expect(r.getByText('GitHub')).toBeTruthy();
    expect(r.getByTestId('ws-status').textContent).toBe('Só local · aaaaaaa');
    fireEvent.click(r.getByText('Restaurar'));
    expect(a.onWsRestore).toHaveBeenCalledWith('atlas1', h1, 'CLAUDE.md');
  });

  it('asks for the diff of a picked commit and hides restore from a student', () => {
    const a = api();
    const r = render(<AgentVersions botId="atlas1" api={a} connected isAdmin={false} />);
    fireEvent.click(r.getByText('edit no repo'));
    expect(a.onWsDiffGet).toHaveBeenCalledWith('atlas1', h2);
    expect(r.queryByText('Restaurar')).toBeNull();
    expect(a.onWsSync).not.toHaveBeenCalled();
  });

  it('shows a connect error with no history yet and never renders an oversized diff', () => {
    const empty = render(<AgentVersions botId="atlas1" api={api({ wsLogs: { atlas1: [] }, wsError: 'falha ao sincronizar' })} connected isAdmin />);
    expect(empty.getByText('Nenhuma versão ainda')).toBeTruthy();
    expect(empty.getByRole('alert').textContent).toBe('falha ao sincronizar');
    cleanup();
    const big = render(<AgentVersions botId="atlas1" api={api({ wsDiffs: { [`atlas1:${h1}`]: { status: 'ok', files: [{ path: 'big.md', old: '', new: '', tooBig: true }] } } })} connected isAdmin />);
    expect(big.getByText('Arquivo grande demais para mostrar aqui.')).toBeTruthy();
    expect(big.getByLabelText('Commits').className).toContain('overflow-y-auto');
  });
});
