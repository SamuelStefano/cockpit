import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';

// Mock every data-layer dependency so handle() routes against predictable stubs.
const runs = vi.hoisted(() => ({
  threads: new Map<string, { handle: { kill: ReturnType<typeof vi.fn> } }>(),
  startRun: vi.fn(),
  routeSend: vi.fn(() => Promise.resolve()),
}));
const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
const parse = vi.hoisted(() => ({ parseSession: vi.fn(), parseFullSession: vi.fn() }));

vi.mock('./runs', () => runs);
vi.mock('./broadcast', () => bc);
vi.mock('../sessions/parse', () => parse);
vi.mock('../sessions/index', () => ({ listSessions: vi.fn(async () => []), listArchived: vi.fn(async () => []) }));
vi.mock('../sessions/search', () => ({ searchSessions: vi.fn(async () => []) }));
vi.mock('../contexts', () => ({ listContexts: vi.fn(async () => []), readContext: vi.fn() }));
vi.mock('../skills', () => ({ listSkills: vi.fn(async () => []), readSkill: vi.fn() }));
vi.mock('../attachments', () => ({ saveAttachment: vi.fn() }));
vi.mock('../db', () => ({ usageStats: vi.fn(() => ({})) }));
vi.mock('../store', () => ({
  hideSession: vi.fn(async () => {}), unhideSession: vi.fn(async () => {}),
  purgeSession: vi.fn(async () => {}), setTitle: vi.fn(async () => {}), setNote: vi.fn(async () => {}),
}));
vi.mock('../health', () => ({ collectHealth: vi.fn(async () => ({})) }));

import { handle } from './dispatch';

const ws = {} as WebSocket;
beforeEach(() => { vi.clearAllMocks(); runs.threads.clear(); });

describe('send routing (the #130 role seam)', () => {
  const msg = (over: Partial<ClientMsg> = {}): ClientMsg => ({
    t: 'send', sessionKey: 'k1', text: 'hi', sessionId: 's1', msgId: 'm1',
    mode: 'auto', model: 'opus', maxBudgetUsd: 5, bypass: false, ...over,
  } as ClientMsg);

  it('routes a FREE session to startRun, threading the role through as the last arg', async () => {
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
    expect(runs.routeSend).not.toHaveBeenCalled();
    const args = runs.startRun.mock.calls[0];
    expect(args[0]).toBe(ws);
    expect(args[1]).toBe('k1');
    expect(args[args.length - 1]).toBe('admin'); // role reaches the engine
  });

  it('routes a BUSY session to routeSend (triage), also threading the role', async () => {
    runs.threads.set('k1', { handle: { kill: vi.fn() } });
    await handle(ws, msg(), 'student');
    expect(runs.routeSend).toHaveBeenCalledOnce();
    expect(runs.startRun).not.toHaveBeenCalled();
    expect(runs.routeSend.mock.calls[0].at(-1)).toBe('student');
  });
});

describe('stop', () => {
  it('kills the thread for the targeted session key only', async () => {
    const kill = vi.fn();
    runs.threads.set('k1', { handle: { kill } });
    await handle(ws, { t: 'stop', sessionKey: 'k1' } as ClientMsg);
    expect(kill).toHaveBeenCalledOnce();
  });

  it('is a no-op when no thread exists for the key', async () => {
    await expect(handle(ws, { t: 'stop', sessionKey: 'ghost' } as ClientMsg)).resolves.toBeUndefined();
  });
});

describe('open / open-full invalid session', () => {
  it('emits an error (not history) when the parser rejects the id', async () => {
    parse.parseSession.mockResolvedValue(null);
    await handle(ws, { t: 'open', sessionId: '../etc' } as ClientMsg);
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'sessão inválida' });
  });

  it('forwards the truncated flag from parseSession on a normal open', async () => {
    parse.parseSession.mockResolvedValue({ messages: [{ role: 'user' }], tokens: 3, truncated: true });
    await handle(ws, { t: 'open', sessionId: 's1' } as ClientMsg);
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', truncated: true }));
  });

  it('sends history with full:true for open-full on a valid session', async () => {
    parse.parseFullSession.mockResolvedValue({ messages: [{ role: 'user' }], tokens: 7 });
    await handle(ws, { t: 'open-full', sessionId: 's1' } as ClientMsg);
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', full: true, tokens: 7 }));
  });
});

describe('purge broadcasts to all clients', () => {
  it('uses broadcast (not send) so every tab drops the deleted session', async () => {
    await handle(ws, { t: 'purge', sessionId: 's1' } as ClientMsg);
    expect(bc.broadcast).toHaveBeenCalled();
    expect(bc.broadcast.mock.calls.some((c) => c[0].t === 'sessions')).toBe(true);
  });
});
