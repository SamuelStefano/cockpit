import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';

// Mock every data-layer dependency so handle() routes against predictable stubs.
const runs = vi.hoisted(() => ({
  threads: new Map<string, { handle: { kill: ReturnType<typeof vi.fn> } }>(),
  startRun: vi.fn(),
  routeSend: vi.fn(() => Promise.resolve()),
  onStop: vi.fn(),
}));
const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
const parse = vi.hoisted(() => ({ parseSession: vi.fn(), parseFullSession: vi.fn() }));
const cfg = vi.hoisted(() => ({ CONFIG: { localOnly: true } }));
const admin = vi.hoisted(() => ({
  setEnv: vi.fn(), unsetEnv: vi.fn(), removeMcp: vi.fn(), installCli: vi.fn(),
  addMcp: vi.fn(async () => ({ ok: true, message: 'ok' })),
}));

vi.mock('./runs', () => runs);
vi.mock('./broadcast', () => bc);
vi.mock('../config', () => cfg);
vi.mock('../admin-ops', () => admin);
vi.mock('../sessions/parse', () => parse);
vi.mock('../sessions/index', () => ({ listSessions: vi.fn(async () => []), listArchived: vi.fn(async () => []) }));
vi.mock('../sessions/search', () => ({ searchSessions: vi.fn(async () => []) }));
vi.mock('../contexts', () => ({ listContexts: vi.fn(async () => []), readContext: vi.fn() }));
vi.mock('../skills', () => ({ listSkills: vi.fn(async () => []), readSkill: vi.fn(), resolveSkillDeny: vi.fn(async () => []) }));
vi.mock('../attachments', () => ({ saveAttachment: vi.fn() }));
vi.mock('../db', () => ({ usageStats: vi.fn(() => ({})) }));
vi.mock('../store', () => ({
  hideSession: vi.fn(async () => {}), unhideSession: vi.fn(async () => {}),
  purgeSession: vi.fn(async () => {}), setTitle: vi.fn(async () => {}), setNote: vi.fn(async () => {}),
}));
vi.mock('../health', () => ({ collectHealth: vi.fn(async () => ({})) }));

import { handle } from './dispatch';

const ws = {} as WebSocket;
beforeEach(() => { vi.clearAllMocks(); runs.threads.clear(); cfg.CONFIG.localOnly = true; });

describe('send routing (the #130 role seam)', () => {
  const msg = (over: Partial<ClientMsg> = {}): ClientMsg => ({
    t: 'send', sessionKey: 'k1', text: 'hi', sessionId: 's1', msgId: 'm1',
    mode: 'auto', model: 'opus', maxBudgetUsd: 5, bypass: false, ...over,
  } as ClientMsg);

  it('routes a FREE session to startRun, threading the role through (disallowedSkills is the last arg)', async () => {
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
    expect(runs.routeSend).not.toHaveBeenCalled();
    const args = runs.startRun.mock.calls[0];
    expect(args[0]).toBe(ws);
    expect(args[1]).toBe('k1');
    expect(args.at(-2)).toBe('admin'); // role reaches the engine
    expect(args.at(-1)).toEqual([]); // resolved skill-deny rules trail the role
  });

  it('routes a BUSY session to routeSend (triage), also threading the role', async () => {
    runs.threads.set('k1', { handle: { kill: vi.fn() } });
    await handle(ws, msg(), 'student');
    expect(runs.routeSend).toHaveBeenCalledOnce();
    expect(runs.routeSend.mock.calls[0].at(-2)).toBe('student');
    expect(runs.startRun).not.toHaveBeenCalled();
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

  it('marks the stop (clears queue + bumps epoch) so no queued/in-triage message launches after stop', async () => {
    runs.threads.set('k1', { handle: { kill: vi.fn() } });
    await handle(ws, { t: 'stop', sessionKey: 'k1' } as ClientMsg);
    expect(runs.onStop).toHaveBeenCalledWith('k1');
  });

  it('marks the stop even when no thread is live', async () => {
    await handle(ws, { t: 'stop', sessionKey: 'ghost' } as ClientMsg);
    expect(runs.onStop).toHaveBeenCalledWith('ghost');
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
    parse.parseFullSession.mockResolvedValue({ messages: [{ role: 'user' }], tokens: 7, truncated: true });
    await handle(ws, { t: 'open-full', sessionId: 's1' } as ClientMsg);
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', full: true, tokens: 7, truncated: true }));
  });
});

describe('admin-mcp-add stdio loopback gate', () => {
  it('blocks a stdio MCP (arbitrary command → RCE) when not loopback', async () => {
    cfg.CONFIG.localOnly = false;
    await handle(ws, { t: 'admin-mcp-add', name: 'evil', command: 'bash -c pwn' } as ClientMsg);
    expect(admin.addMcp).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'admin-op', ok: false, message: 'MCP stdio só no loopback' });
  });

  it('allows a url MCP (http, no subprocess) even when not loopback', async () => {
    cfg.CONFIG.localOnly = false;
    await handle(ws, { t: 'admin-mcp-add', name: 'remote', url: 'https://mcp.example/sse' } as ClientMsg);
    expect(admin.addMcp).toHaveBeenCalledOnce();
  });

  it('allows a stdio MCP on the loopback box (owner)', async () => {
    cfg.CONFIG.localOnly = true;
    await handle(ws, { t: 'admin-mcp-add', name: 'local', command: 'node mcp.js' } as ClientMsg);
    expect(admin.addMcp).toHaveBeenCalledOnce();
  });
});

describe('purge broadcasts to all clients', () => {
  it('uses broadcast (not send) so every tab drops the deleted session', async () => {
    await handle(ws, { t: 'purge', sessionId: 's1' } as ClientMsg);
    expect(bc.broadcast).toHaveBeenCalled();
    expect(bc.broadcast.mock.calls.some((c) => c[0].t === 'sessions')).toBe(true);
  });
});
