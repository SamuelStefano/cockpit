import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';

// Mock every data-layer dependency so handle() routes against predictable stubs.
const runs = vi.hoisted(() => ({
  startRun: vi.fn(),
  routeSend: vi.fn((_opts: unknown) => Promise.resolve()),
}));
const reg = vi.hoisted(() => {
  const threads = new Map<string, { handle: { kill: () => void } }>();
  const onStop = vi.fn();
  return {
    threads,
    onStop,
    // Espelha o real: resolve a chave (aqui a chave direta basta), marca o stop e mata.
    stopSession: vi.fn((key: string) => { onStop(key); threads.get(key)?.handle.kill(); }),
  };
});
const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
const parse = vi.hoisted(() => ({ parseSession: vi.fn(), parseFullSession: vi.fn() }));
const cfg = vi.hoisted(() => ({ CONFIG: { localOnly: true, historyLimit: 2000 } }));
const admin = vi.hoisted(() => ({
  setEnv: vi.fn(), unsetEnv: vi.fn(), removeMcp: vi.fn(), installCli: vi.fn(),
  addMcp: vi.fn(async () => ({ ok: true, message: 'ok' })),
}));

vi.mock('./runs', () => runs);
vi.mock('./threads', () => reg);
vi.mock('./broadcast', () => bc);
vi.mock('../config', () => cfg);
vi.mock('../admin-ops', () => admin);
vi.mock('../sessions/parse', () => parse);
vi.mock('../sessions/index', () => ({ listSessions: vi.fn(async () => []), listArchived: vi.fn(async () => []) }));
vi.mock('../sessions/search', () => ({ searchSessions: vi.fn(async () => []) }));
vi.mock('../contexts', () => ({ listContexts: vi.fn(async () => []), readContext: vi.fn() }));
vi.mock('../skills', () => ({ listSkills: vi.fn(async () => []), readSkill: vi.fn(), resolveSkillDeny: vi.fn(async () => []) }));
vi.mock('../attachments', () => ({ addUploadChunk: vi.fn(), readAttachment: vi.fn() }));
vi.mock('../db', () => ({ usageStats: vi.fn(() => ({})) }));
vi.mock('../store', () => ({
  hideSession: vi.fn(async () => {}), unhideSession: vi.fn(async () => {}),
  purgeSession: vi.fn(async () => {}), setTitle: vi.fn(async () => {}), setNote: vi.fn(async () => {}),
}));
vi.mock('../health', () => ({ collectHealth: vi.fn(async () => ({})) }));
const crons = vi.hoisted(() => ({
  getCrons: vi.fn(async () => []), saveCron: vi.fn(async () => []), deleteCron: vi.fn(async () => []),
}));
vi.mock('../crons', () => crons);

import { handle } from './dispatch';

const ws = {} as WebSocket;
beforeEach(() => { vi.clearAllMocks(); reg.threads.clear(); cfg.CONFIG.localOnly = true; });

describe('send routing (the #130 role seam)', () => {
  const msg = (over: Partial<ClientMsg> = {}): ClientMsg => ({
    t: 'send', sessionKey: 'k1', text: 'hi', sessionId: 's1', msgId: 'm1',
    mode: 'auto', model: 'opus', maxBudgetUsd: 5, bypass: false, ...over,
  } as ClientMsg);

  it('routes a FREE session to startRun, threading the role through', async () => {
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
    expect(runs.routeSend).not.toHaveBeenCalled();
    expect(runs.startRun.mock.calls[0][0]).toMatchObject({
      ws,
      sessionKey: 'k1',
      prompt: 'hi',
      resumeId: 's1',
      msgId: 'm1',
      role: 'admin',
      disallowedSkills: [], // regras de negação resolvidas
      mcps: undefined,      // nenhum selecionado neste msg
      effort: undefined,    // não enviado neste msg
      auto: false,          // send manual
    });
  });

  it('routes a BUSY session to routeSend (triage), also threading the role', async () => {
    reg.threads.set('k1', { handle: { kill: vi.fn() } });
    await handle(ws, msg(), 'student');
    expect(runs.routeSend).toHaveBeenCalledOnce();
    expect(runs.routeSend.mock.calls[0][0]).toMatchObject({ sessionKey: 'k1', role: 'student' });
    expect(runs.startRun).not.toHaveBeenCalled();
  });
});

describe('stop', () => {
  it('kills the thread for the targeted session key only', async () => {
    const kill = vi.fn();
    reg.threads.set('k1', { handle: { kill } });
    await handle(ws, { t: 'stop', sessionKey: 'k1' } as ClientMsg);
    expect(kill).toHaveBeenCalledOnce();
  });

  it('is a no-op when no thread exists for the key', async () => {
    await expect(handle(ws, { t: 'stop', sessionKey: 'ghost' } as ClientMsg)).resolves.toBeUndefined();
  });

  it('marks the stop (clears queue + bumps epoch) so no queued/in-triage message launches after stop', async () => {
    reg.threads.set('k1', { handle: { kill: vi.fn() } });
    await handle(ws, { t: 'stop', sessionKey: 'k1' } as ClientMsg);
    expect(reg.onStop).toHaveBeenCalledWith('k1');
  });

  it('marks the stop even when no thread is live', async () => {
    await handle(ws, { t: 'stop', sessionKey: 'ghost' } as ClientMsg);
    expect(reg.onStop).toHaveBeenCalledWith('ghost');
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

  it('repassa o cursor `before` ao parser e marca o frame como prepend', async () => {
    parse.parseFullSession.mockResolvedValue({ messages: [], tokens: 0, truncated: false });
    await handle(ws, { t: 'open-full', sessionId: 's1', before: 'uuid-9' } as ClientMsg);
    expect(parse.parseFullSession).toHaveBeenCalledWith('s1', 'uuid-9');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', prepend: true }));
  });

  it('ignora um cursor que não é string (entrada não confiável) e serve a última página', async () => {
    parse.parseFullSession.mockResolvedValue({ messages: [], tokens: 0, truncated: false });
    await handle(ws, { t: 'open-full', sessionId: 's1', before: { evil: 1 } } as unknown as ClientMsg);
    expect(parse.parseFullSession).toHaveBeenCalledWith('s1', undefined);
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', prepend: false }));
  });
});

describe('open com cadeia ativa colapsada (pós-/compact)', () => {
  it('serve a timeline completa quando ela tem substancialmente mais mensagens', async () => {
    parse.parseSession.mockResolvedValue({ messages: [{ role: 'user' }], tokens: 1, truncated: true });
    parse.parseFullSession.mockResolvedValue({ messages: [{ role: 'user' }, { role: 'user' }, { role: 'user' }], tokens: 9, truncated: true });
    await handle(ws, { t: 'open', sessionId: 's1' } as ClientMsg);
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', full: true, tokens: 9 }));
  });

  it('mantém a cadeia ativa quando a timeline completa não acrescenta quase nada', async () => {
    parse.parseSession.mockResolvedValue({ messages: [{ role: 'user' }, { role: 'user' }], tokens: 1, truncated: true });
    parse.parseFullSession.mockResolvedValue({ messages: [{ role: 'user' }, { role: 'user' }, { role: 'user' }], tokens: 9, truncated: false });
    await handle(ws, { t: 'open', sessionId: 's1' } as ClientMsg);
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', tokens: 1 }));
  });

  it('não toca a timeline completa quando a cadeia ativa já está inteira', async () => {
    parse.parseSession.mockResolvedValue({ messages: [{ role: 'user' }], tokens: 1, truncated: false });
    await handle(ws, { t: 'open', sessionId: 's1' } as ClientMsg);
    expect(parse.parseFullSession).not.toHaveBeenCalled();
  });

  it('não reparseia o arquivo quando a cadeia ativa já passou de metade do cap', async () => {
    const chain = Array.from({ length: cfg.CONFIG.historyLimit }, () => ({ role: 'user' }));
    parse.parseSession.mockResolvedValue({ messages: chain, tokens: 1, truncated: true });
    await handle(ws, { t: 'open', sessionId: 's1' } as ClientMsg);
    expect(parse.parseFullSession).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', tokens: 1 }));
  });

  it('respeita chainOnly: quem pediu "mostrar resumido" não recebe a timeline completa de volta', async () => {
    parse.parseSession.mockResolvedValue({ messages: [{ role: 'user' }], tokens: 1, truncated: true });
    await handle(ws, { t: 'open', sessionId: 's1', chainOnly: true } as ClientMsg);
    expect(parse.parseFullSession).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'history', tokens: 1 }));
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

describe('cron-save boundary', () => {
  const msg = (schedule: unknown): ClientMsg => ({
    t: 'cron-save',
    cron: { id: 'c1', name: 'n', prompt: 'p', schedule, enabled: true, createdAt: 0 },
  } as ClientMsg);

  it('persiste um "uma vez" com instante válido', async () => {
    await handle(ws, msg({ kind: 'once', atMs: 1784973360000 }));
    expect(crons.saveCron).toHaveBeenCalledOnce();
  });

  it('rejeita kind desconhecido e atMs lixo sem tocar o disco', async () => {
    await handle(ws, msg({ kind: 'evil' }));
    await handle(ws, msg({ kind: 'once', atMs: 'amanhã' }));
    expect(crons.saveCron).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'cron inválido' });
  });
});

describe('purge broadcasts to all clients', () => {
  it('uses broadcast (not send) so every tab drops the deleted session', async () => {
    await handle(ws, { t: 'purge', sessionId: 's1' } as ClientMsg);
    expect(bc.broadcast).toHaveBeenCalled();
    expect(bc.broadcast.mock.calls.some((c) => c[0].t === 'sessions')).toBe(true);
  });
});
