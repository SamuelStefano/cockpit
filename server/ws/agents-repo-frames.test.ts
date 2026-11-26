import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

const sent = vi.hoisted(() => ({ fn: vi.fn() }));
const history = vi.hoisted(() => ({
  botLog: vi.fn(async () => []), botDiff: vi.fn(async () => ({ files: [], patch: '' })),
  restoreFile: vi.fn(async () => ({ ok: true, mtime: 1 })), headStatus: vi.fn(async () => ({})),
}));
const remote = vi.hoisted(() => ({
  repoStatus: vi.fn(async () => ({})), currentConflicts: () => [], startSyncTimer: vi.fn(),
  syncAll: vi.fn(async () => ({ conflicts: [] })), connectRepo: vi.fn(async () => ({ conflicts: [] })), listInstallationRepos: vi.fn(async () => ['demo/deck-agents']),
}));
vi.mock('../agents-repo/remote', () => remote);
vi.mock('./broadcast', () => ({ send: sent.fn }));
vi.mock('../team', () => ({ getTeam: async () => [{ id: 'capo1', name: 'Capo' }] }));
vi.mock('../agents-repo/history', () => history);

import { sendWsDiff, sendWsLog, sendWsRepos, wsRestore, wsSync } from './agents-repo-frames';

const ws = { readyState: 1, OPEN: 1 } as unknown as WebSocket;

describe('agents repo frames', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves log and diff only for a bot of this team', async () => {
    await sendWsLog(ws, 'other1');
    expect(sent.fn).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'team-ws-log', error: 'bot não encontrado' }));
    await sendWsDiff(ws, 'other1', 'abcdef1');
    expect(history.botLog).not.toHaveBeenCalled();
    expect(history.botDiff).not.toHaveBeenCalled();
    await sendWsLog(ws, 'capo1');
    expect(history.botLog).toHaveBeenCalledWith('capo1');
  });

  it('restore is admin-only', async () => {
    await wsRestore(ws, 'capo1', 'abcdef1', 'CLAUDE.md', 'student');
    expect(history.restoreFile).not.toHaveBeenCalled();
    expect(sent.fn).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'team-ws-restored', ok: false }));
    await wsRestore(ws, 'capo1', 'abcdef1', 'CLAUDE.md', 'admin');
    expect(history.restoreFile).toHaveBeenCalledWith('capo1', 'Capo', 'abcdef1', 'CLAUDE.md');
  });

  it('sync is admin-only and repos go out as names only', async () => {
    await wsSync(ws, 'student');
    expect(remote.syncAll).not.toHaveBeenCalled();
    await wsSync(ws, 'admin');
    expect(remote.syncAll).toHaveBeenCalledWith([{ id: 'capo1', name: 'Capo' }]);
    await sendWsRepos(ws);
    expect(sent.fn).toHaveBeenLastCalledWith(ws, { t: 'team-ws-repos', repos: ['demo/deck-agents'] });
  });
});
