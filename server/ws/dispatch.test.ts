import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';
import type { ClientMsg } from '../../shared/protocol';

// Mock every data-layer dependency so handle() routes against predictable stubs.
const runs = vi.hoisted(() => ({
  startRun: vi.fn(),
  routeSend: vi.fn((_opts: unknown) => Promise.resolve()),
  drainParked: vi.fn(),
  runParkedNow: vi.fn(() => ({ ok: true as const })),
  runParkedInBackground: vi.fn(() => ({ forkId: 'f1' })),
}));
const parked = vi.hoisted(() => ({
  addParked: vi.fn(() => ({ id: 'pk-1' })), removeParked: vi.fn(), editParked: vi.fn(),
  moveParked: vi.fn(), clearParked: vi.fn(), retryParked: vi.fn(),
  parkedView: vi.fn(() => []), isQueuePaused: vi.fn(() => false), setQueuePaused: vi.fn(),
  REJECT_MESSAGE: {} as Record<string, string>,
}));
const awaiting = vi.hoisted(() => ({ clearAwaiting: vi.fn() }));
const reg = vi.hoisted(() => {
  const threads = new Map<string, { handle: { kill: () => void }; sessionId?: string }>();
  const onStop = vi.fn();
  // Espelha o real resolveThreadKey (server/ws/threads.ts): chave direta, senão
  // procura por sessionId — usado tanto pelo stopSession quanto pelo 'send'.
  const resolveThreadKey = vi.fn((key: string) => {
    if (threads.has(key)) return key;
    for (const [k, t] of threads) if (t.sessionId === key) return k;
    return undefined;
  });
  return {
    threads,
    onStop,
    resolveThreadKey,
    // Espelha o real: resolve a chave (aqui a chave direta basta), marca o stop e mata.
    stopSession: vi.fn((key: string) => { onStop(key); threads.get(key)?.handle.kill(); }),
  };
});
const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
const termStats = vi.hoisted(() => ({
  collectTermStats: vi.fn(async () => ({})),
  // Default false: most tests aren't exercising the double-writer guard, and
  // the real implementation shells out to tmux/proc — never let it run for real.
  hasInteractiveClaude: vi.fn(async () => false),
  // dispatch.ts keys canvas-term-stats CPU samples per socket (review #595
  // point 5) via a real Map from newCpuSamples() — a fresh one each call is
  // exactly what the real implementation does, no behavior to fake here.
  newCpuSamples: vi.fn(() => new Map()),
}));
const parse = vi.hoisted(() => ({ parseSession: vi.fn(), parseFullSession: vi.fn() }));
const cfg = vi.hoisted(() => ({ CONFIG: { localOnly: true, historyLimit: 2000 } }));
const admin = vi.hoisted(() => ({
  setEnv: vi.fn(), unsetEnv: vi.fn(), removeMcp: vi.fn(), installCli: vi.fn(),
  addMcp: vi.fn(async () => ({ ok: true, message: 'ok' })),
}));

vi.mock('./runs', () => runs);
vi.mock('./parked', () => parked);
vi.mock('./awaiting', () => awaiting);
vi.mock('./threads', () => reg);
vi.mock('./broadcast', () => bc);
vi.mock('../canvas/term-stats', () => termStats);
vi.mock('../config', () => cfg);
vi.mock('../admin-ops', () => admin);
const deck = vi.hoisted(() => ({
  updateClaudeCli: vi.fn(async () => ({ ok: true, message: 'CLI 1 → 2' })),
  restartDeck: vi.fn(async () => ({ ok: true, message: 'agendado' })),
}));
vi.mock('../deck-ops', () => deck);
vi.mock('../sessions/parse', () => parse);
vi.mock('../sessions/index', () => ({ listSessions: vi.fn(async () => []), listArchived: vi.fn(async () => []) }));
vi.mock('../sessions/search', () => ({ searchSessions: vi.fn(async () => []) }));
vi.mock('../contexts', () => ({ listContexts: vi.fn(async () => []), readContext: vi.fn() }));
vi.mock('../skills', () => ({ listSkills: vi.fn(async () => []), readSkill: vi.fn(), resolveSkillDeny: vi.fn(async () => []) }));
vi.mock('../attachments', () => ({ addUploadChunk: vi.fn(), readAttachment: vi.fn() }));
vi.mock('../db', () => ({ usageStats: vi.fn(() => ({})), lastUsageOf: vi.fn(() => null) }));
vi.mock('../store', () => ({
  hideSession: vi.fn(async () => {}), unhideSession: vi.fn(async () => {}),
  purgeSession: vi.fn(async () => {}), setTitle: vi.fn(async () => {}), setNote: vi.fn(async () => {}),
}));
vi.mock('../health', () => ({ collectHealth: vi.fn(async () => ({})) }));
const crons = vi.hoisted(() => ({
  getCrons: vi.fn(async () => []), saveCron: vi.fn(async () => []), deleteCron: vi.fn(async () => []),
}));
vi.mock('../crons', () => crons);
const drafts = vi.hoisted(() => ({
  readDrafts: vi.fn(async () => []),
  mutateDrafts: vi.fn(async () => [{ id: 'ep-1', title: 'E', status: 'draft', createdAt: 0, tasks: [] }]),
}));
vi.mock('../dfl-drafts', () => drafts);
const fin = vi.hoisted(() => ({ registerFinanceClient: vi.fn(), emitFinanceMsg: vi.fn() }));
vi.mock('./finance-clients', () => fin);

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

  // canvas review #593 item 1: a session can be live under a DIFFERENT thread
  // key (a cron run, a flow's own key) than the sessionId a canvas prompt bar
  // names. Routing blind to `msg.sessionKey` would spawn a SECOND
  // `claude --resume` on top of the real run — resolveThreadKey must find it
  // by sessionId and route the triage to the REAL key instead.
  it('a session live under a DIFFERENT thread key still routes to routeSend on the REAL key, never startRun', async () => {
    reg.threads.set('cron-nightly', { handle: { kill: vi.fn() }, sessionId: 's1' });
    await handle(ws, msg({ sessionKey: 's1', sessionId: 's1' }), 'admin');
    expect(runs.routeSend).toHaveBeenCalledOnce();
    expect(runs.routeSend.mock.calls[0][0]).toMatchObject({ sessionKey: 'cron-nightly' });
    expect(runs.startRun).not.toHaveBeenCalled();
  });

  // canvas review #593 second pass item 1: the client-side "disable the
  // prompt bar after retomar" flag is only a UX hint — it resets on F5 and
  // can't see a pane resumed BY HAND. The server checks the watch pane's own
  // process tree (hasInteractiveClaude) as ground truth before EITHER
  // routing path, and refuses with a message the client can restore text
  // from — never starts a run nor triages into the live thread.
  it('refuses (send-reject, not a plain error) when the session watch pane already has an interactive claude, before routing either way', async () => {
    termStats.hasInteractiveClaude.mockResolvedValueOnce(true);
    reg.threads.set('k1', { handle: { kill: vi.fn() } }); // even a BUSY thread must not get routed to
    await handle(ws, msg(), 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({
      t: 'send-reject', sessionKey: 'k1', reason: 'live-elsewhere', text: 'hi', msgId: 'm1',
    }));
    expect(runs.startRun).not.toHaveBeenCalled();
    expect(runs.routeSend).not.toHaveBeenCalled();
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

describe('admin-cli-update / admin-deck-restart', () => {
  it('refuses both outside the loopback box', async () => {
    cfg.CONFIG.localOnly = false;
    await handle(ws, { t: 'admin-cli-update' } as ClientMsg);
    await handle(ws, { t: 'admin-deck-restart', mode: 'now' } as ClientMsg);
    expect(deck.updateClaudeCli).not.toHaveBeenCalled();
    expect(deck.restartDeck).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'admin-op', ok: false, message: 'atualização do CLI só no loopback' });
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'admin-op', ok: false, message: 'restart do Deck só no loopback' });
  });

  it('updates the CLI and re-emits health', async () => {
    await handle(ws, { t: 'admin-cli-update' } as ClientMsg);
    expect(deck.updateClaudeCli).toHaveBeenCalledOnce();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'admin-op', ok: true, message: 'CLI 1 → 2' });
    expect(bc.send.mock.calls[1][1]).toMatchObject({ t: 'health' });
  });

  it('idle restart awaits the script and re-emits health', async () => {
    await handle(ws, { t: 'admin-deck-restart', mode: 'idle' } as ClientMsg);
    expect(deck.restartDeck).toHaveBeenCalledWith('idle');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'admin-op', ok: true, message: 'agendado' });
    expect(bc.send.mock.calls[1][1]).toMatchObject({ t: 'health' });
  });

  it('restart now answers BEFORE killing itself, and only then runs the script', async () => {
    vi.useFakeTimers();
    try {
      await handle(ws, { t: 'admin-deck-restart', mode: 'now' } as ClientMsg);
      expect(bc.send).toHaveBeenCalledWith(ws, { t: 'admin-op', ok: true, message: 'reiniciando agora — o Deck volta em alguns segundos' });
      expect(deck.restartDeck).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(300);
      expect(deck.restartDeck).toHaveBeenCalledWith('now');
    } finally { vi.useRealTimers(); }
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

describe('pontos-agent-tasks (botão "criar tasks com agente")', () => {
  const msg = (over: Record<string, unknown> = {}): ClientMsg => ({
    t: 'pontos-agent-tasks', reqId: 'r1', note: 'lesson studio',
    epicCapCents: 500_000, monthCapCents: 400_000, pointValue: 75, ...over,
  } as ClientMsg);

  it('abre um turno autônomo com o prompt que carrega os dois tetos', async () => {
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
    const opts = runs.startRun.mock.calls[0][0] as { ws: unknown; sessionKey: string; prompt: string; mode: string };
    expect(opts.ws).toBeNull();
    expect(opts.sessionKey).toMatch(/^pontos-agent-/);
    expect(opts.mode).toBe('acceptEdits');
    expect(opts.prompt).toContain('R$ 5.000,00');
    expect(opts.prompt).toContain('R$ 4.000,00');
    expect(opts.prompt).toContain('lesson studio');
  });

  it('target drafts: o agente monta no Deck (deck-drafts), não no DFL', async () => {
    await handle(ws, msg({ target: 'drafts' }), 'admin');
    const opts = runs.startRun.mock.calls[0][0] as { prompt: string };
    expect(opts.prompt).toContain('~/bin/deck-drafts import');
    expect(opts.prompt).toContain('NÃO use o MCP dfl-work');
  });

  it('responde ok com a sessão pra a UI mandar ele acompanhar', async () => {
    await handle(ws, msg(), 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'points-dfl-write', reqId: 'r1', kind: 'agent', ok: true }));
  });

  it('fora do loopback não dispara nada', async () => {
    cfg.CONFIG.localOnly = false;
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ kind: 'agent', ok: false }));
  });

  it('recusa nota grande demais em vez de estourar o teto de prompt', async () => {
    await handle(ws, msg({ note: 'x'.repeat(9000) }), 'admin');
    expect(runs.startRun).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ kind: 'agent', ok: false, message: 'nota grande demais' }));
  });
});

describe('ações da fila estacionada', () => {
  beforeEach(() => {
    runs.runParkedNow.mockReturnValue({ ok: true as const });
    parked.parkedView.mockReturnValue([]);
  });

  // Recusar um disparo mandava um 'error' COM sessionKey, e o cliente trata isso
  // como "este turno morreu": a resposta em voo congelava na tela. A fila só enche
  // com turno rodando, então essa era a situação normal do clique.
  it('recusa de furar a fila não vai pelo canal que encerra o turno', async () => {
    runs.runParkedNow.mockReturnValue({ reject: 'sem-quota' } as never);
    await handle(ws, { t: 'queue-run-now', sessionKey: 'k1', id: 'pk-1' } as ClientMsg, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'queue-error', sessionKey: 'k1' }));
    expect(bc.send).not.toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'error' }));
  });

  it('recusa do disparo em paralelo idem', async () => {
    runs.runParkedInBackground.mockReturnValue({ reject: 'sem-slot' } as never);
    await handle(ws, { t: 'queue-run-bg', sessionKey: 'k1', id: 'pk-1' } as ClientMsg, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'queue-error', sessionKey: 'k1' }));
    expect(bc.send).not.toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'error' }));
  });

  it('furar a fila leva o papel adiante (item de admin não sobe pela mão de student)', async () => {
    await handle(ws, { t: 'queue-run-now', sessionKey: 'k1', id: 'pk-1' } as ClientMsg, 'student');
    expect(runs.runParkedNow).toHaveBeenCalledWith('k1', 'pk-1', 'student');
  });

  // Sem o snapshot o clique em "enviar mesmo assim" não mudava nada na tela quando
  // o dreno não subia nada — o botão parecia morto.
  it('forçar a fila devolve o snapshot da fila', async () => {
    await handle(ws, { t: 'queue-force', sessionKey: 'k1' } as ClientMsg, 'admin');
    expect(awaiting.clearAwaiting).toHaveBeenCalledWith('k1');
    expect(bc.broadcast).toHaveBeenCalledWith(expect.objectContaining({ t: 'queue' }));
  });
});

describe('drafts (Rascunhos para o DFL)', () => {
  it('drafts-get answers only the asking socket and registers it for pushes', async () => {
    await handle(ws, { t: 'drafts-get' }, 'admin');
    expect(fin.registerFinanceClient).toHaveBeenCalledWith(ws);
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'drafts', items: [] });
    expect(bc.broadcast).not.toHaveBeenCalled();
  });

  it('a valid op is applied and pushed to finance sockets, never the global broadcast', async () => {
    await handle(ws, { t: 'drafts-op', op: { op: 'delete-epic', id: 'ep-9' } }, 'admin');
    expect(drafts.mutateDrafts).toHaveBeenCalledWith({ op: 'delete-epic', id: 'ep-9' });
    expect(fin.emitFinanceMsg).toHaveBeenCalledWith(expect.objectContaining({ t: 'drafts' }));
    expect(bc.broadcast).not.toHaveBeenCalled();
  });

  it('an unknown op is refused without touching the file', async () => {
    await handle(ws, { t: 'drafts-op', op: { op: 'rm' } } as unknown as ClientMsg, 'admin');
    expect(drafts.mutateDrafts).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'error' }));
  });

  it('a rule violation comes back as an error message', async () => {
    drafts.mutateDrafts.mockRejectedValueOnce(new Error('épico ep-x não existe'));
    await handle(ws, { t: 'drafts-op', op: { op: 'delete-task', epicId: 'ep-x', taskId: 't' } }, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'épico ep-x não existe' });
  });
});
