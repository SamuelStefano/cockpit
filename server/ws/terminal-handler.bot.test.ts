import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';

const term = vi.hoisted(() => ({
  openTerm: vi.fn(() => true),
  detachTerm: vi.fn(), inputTerm: vi.fn(), resizeTerm: vi.fn(), closeTerm: vi.fn(),
  listTerms: vi.fn(async () => []), resumeTerm: vi.fn(async () => true),
  ensureWatchReaper: vi.fn(), prepareWatch: vi.fn(async () => {}),
}));
const sent = vi.hoisted(() => ({ fn: vi.fn() }));
const cwd = vi.hoisted(() => ({ fn: vi.fn((id: string) => `/bots/${id}/workspace` as string | null) }));

vi.mock('../terminals', () => term);
vi.mock('./broadcast', () => ({ send: sent.fn }));
vi.mock('../team', () => ({ getTeam: async () => [{ id: 'capo1' }] }));
vi.mock('../team-computer', () => ({ botTermCwd: cwd.fn }));

import { handleTerm, type TermHandle } from './terminal-handler';

const ws = { readyState: 1, OPEN: 1 } as unknown as WebSocket;
const flush = () => new Promise((r) => setTimeout(r, 0));
const open = (m: Partial<Extract<ClientMsg, { t: 'term-open' }>>) =>
  handleTerm(ws, { t: 'term-open', termId: 'bot-capo1', cols: 80, rows: 24, ...m } as ClientMsg, new Map<string, TermHandle>());

beforeEach(() => { vi.clearAllMocks(); cwd.fn.mockImplementation((id: string) => `/bots/${id}/workspace`); });

describe('term-open with botId (Assumir)', () => {
  it('opens the bot terminal in the workspace resolved by the server', async () => {
    expect(open({ botId: 'capo1' })).toBe(true);
    await flush();
    expect(term.openTerm).toHaveBeenCalledTimes(1);
    expect((term.openTerm.mock.calls[0] as unknown[])[7]).toBe('/bots/capo1/workspace');
  });

  it('refuses a bot outside this team', async () => {
    open({ termId: 'bot-other1', botId: 'other1' });
    await flush();
    expect(term.openTerm).not.toHaveBeenCalled();
    expect(sent.fn).toHaveBeenCalledWith(ws, { t: 'term-exit', termId: 'bot-other1' });
  });

  it('refuses a term id that is not the bot one, and watch mixed in', async () => {
    open({ termId: 'main', botId: 'capo1' });
    open({ botId: 'capo1', watch: '00000000-0000-0000-0000-000000000000' });
    await flush();
    expect(term.openTerm).not.toHaveBeenCalled();
    expect(sent.fn).toHaveBeenCalledWith(ws, { t: 'term-exit', termId: 'main' });
  });

  it('refuses when the workspace does not resolve inside botsRoot', async () => {
    cwd.fn.mockReturnValue(null);
    open({ botId: 'capo1' });
    await flush();
    expect(term.openTerm).not.toHaveBeenCalled();
    expect(sent.fn).toHaveBeenCalledWith(ws, { t: 'term-exit', termId: 'bot-capo1' });
  });

  it('a plain open keeps the old path (no cwd)', () => {
    handleTerm(ws, { t: 'term-open', termId: 'main', cols: 80, rows: 24 }, new Map());
    expect((term.openTerm.mock.calls[0] as unknown[])[7]).toBeUndefined();
  });

  it('refuses a bot-* term-open without botId', () => {
    handleTerm(ws, { t: 'term-open', termId: 'bot-capo1', cols: 80, rows: 24 }, new Map());
    expect(term.openTerm).not.toHaveBeenCalled();
    expect(sent.fn).toHaveBeenCalledWith(ws, { t: 'term-exit', termId: 'bot-capo1' });
  });
});
