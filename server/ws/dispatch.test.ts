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
  acceptResumeOffer: vi.fn(() => true),
  refreshBusyElsewhere: vi.fn(async () => {}),
  // Default: never the Orchestrator's own pane — most tests aren't
  // exercising that exemption (server/ws/runs.ts's real predicate, reused
  // rather than duplicated by the 'send' guard).
  orchestratorPaneTarget: vi.fn((): { name: string; sessionId: string; tmux: string } | undefined => undefined),
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
    runningSessionIds: vi.fn(() => new Set<string>()),
  };
});
const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
const termStats = vi.hoisted(() => ({
  collectTermStats: vi.fn(async () => ({})),
  // review #597 follow-up point 2: a SEPARATE, lighter path from
  // collectTermStats — never touches the CPU sample store.
  collectCtxOnly: vi.fn(async () => ({})),
  // Default false: most tests aren't exercising the double-writer guard, and
  // the real implementation shells out to tmux/proc — never let it run for real.
  hasInteractiveClaude: vi.fn(async () => false),
  // dispatch.ts keys canvas-term-stats CPU samples per socket (review #595
  // point 5) via a real Map from newCpuSamples() — a fresh one each call is
  // exactly what the real implementation does, no behavior to fake here.
  newCpuSamples: vi.fn(() => new Map()),
}));
const cvLiveness = vi.hoisted(() => ({
  // FRESH (not cached — server/canvas/cv-liveness.ts) strict read the 'send'
  // cross-process guard actually checks: alive pid + busy, no fresh-mtime
  // grace, minus this process's own threads. Default empty: most tests
  // aren't exercising it.
  readBusyElsewhereSessionIds: vi.fn(async (): Promise<string[]> => []),
  // FRESH snapshot for the 'canvas-get' cv-live reply, NOT the guard.
  refreshLivenessSnapshot: vi.fn(async () => ({ live: [] as string[], busyElsewhere: [] as string[], idle: [] as string[] })),
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
vi.mock('../canvas/cv-liveness', () => cvLiveness);
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
// Minimal stand-ins for the 'canvas-get' path (only readBoardChained,
// buildCanvas, activeFlowRuns, registerCanvasClient and
// updateAreaCacheFromGraph are actually called there) — MAX_FLOWS and the
// rest of ../canvas/board exist only so the destructured import doesn't
// blow up; no other test in this file exercises them.
const board = vi.hoisted(() => ({
  MAX_FLOWS: 20,
  readBoardChained: vi.fn(async () => ({ cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {} })),
  readBoard: vi.fn(), updateBoard: vi.fn(), sanitizeCard: vi.fn(), sanitizeFlow: vi.fn(), sanitizePos: vi.fn(),
  upsertCard: vi.fn(), upsertFlow: vi.fn(), removeCard: vi.fn(), removeFlow: vi.fn(), checkFlowSave: vi.fn(),
  mergePos: vi.fn(), setBudget: vi.fn(), sanitizeSessionStatus: vi.fn(), setSessionStatus: vi.fn(),
  setCardDflLink: vi.fn(), clearCardDflLink: vi.fn(),
}));
vi.mock('../canvas/board', () => board);
const canvasIndex = vi.hoisted(() => ({ buildCanvas: vi.fn(async () => ({ nodes: [], edges: [] })) }));
vi.mock('../canvas/index', () => canvasIndex);
const flowRuns = vi.hoisted(() => ({ activeFlowRuns: vi.fn(() => []) }));
vi.mock('../canvas/flow-runs', () => flowRuns);
const canvasClients = vi.hoisted(() => ({ registerCanvasClient: vi.fn(), emitCanvasMsg: vi.fn() }));
vi.mock('./canvas-clients', () => canvasClients);
const autopause = vi.hoisted(() => ({ updateAreaCacheFromGraph: vi.fn(), getAreaOf: vi.fn(() => ({})) }));
vi.mock('../canvas/autopause-loop', () => autopause);

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

  // Deck runs two backend processes (server/index.ts, server/agent.ts), each
  // with its own `threads` map. readBusyElsewhereSessionIds() already
  // subtracts THIS process's own threads (server/canvas/cv-liveness.ts), so
  // a match there is by construction a turn live in the OTHER one —
  // starting a `claude --resume` on top of it would fork the transcript.
  it('refuses (send-reject, live-elsewhere) when the target session is strictly busy elsewhere and not one of THIS process\'s own threads', async () => {
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce(['s1']); // msg().sessionId === 's1'
    await handle(ws, msg(), 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({
      t: 'send-reject', sessionKey: 'k1', reason: 'live-elsewhere', text: 'hi', msgId: 'm1',
    }));
    expect(runs.startRun).not.toHaveBeenCalled();
    expect(runs.routeSend).not.toHaveBeenCalled();
  });

  it('starts normally when the registry has no strict busy-elsewhere match for the session', async () => {
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce([]);
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
  });

  // BLOCKER (2nd review): startCvLivenessLoop's cache only refreshes while a
  // client is connected — deckctl's connection (a few seconds) can come and
  // go between 5s ticks without a single one running, leaving any cached
  // value stale by hours. The guard must call readBusyElsewhereSessionIds
  // FRESH on every 'send', never read a memoized value — simulated here by
  // flipping the mock's resolved value between two consecutive calls and
  // checking each call reacts to ITS OWN fresh read, not the previous one.
  it('reacts to a fresh read each call, never a stale one from a previous call', async () => {
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce(['s1']);
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).not.toHaveBeenCalled();

    // "cache" (i.e. the previous call's answer) said busy; the registry NOW
    // says idle — this send must go through.
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce([]);
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
  });

  it('reacts to the reverse flip too — was clear, is now busy elsewhere', async () => {
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce([]);
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();

    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce(['s1']);
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce(); // still just the once from the first call
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ reason: 'live-elsewhere' }));
  });

  // The guard is best-effort: a broken/unreadable registry must never itself
  // block Samuel from sending a message.
  it('fails OPEN (allows the send) when the fresh registry read throws', async () => {
    cvLiveness.readBusyElsewhereSessionIds.mockRejectedValueOnce(new Error('EACCES'));
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
    expect(bc.send).not.toHaveBeenCalledWith(ws, expect.objectContaining({ reason: 'live-elsewhere' }));
  });

  // The BLOCKER the previous review guarded against: a browser turn on 's1'
  // just ended in the OTHER process (its thread is gone there too), Samuel
  // sends a normal follow-up within the fresh-mtime grace window. The
  // 'send' guard never even reads the display snapshot (refreshLivenessSnapshot
  // is 'canvas-get'-only, see the describe block below) — only the strict
  // busy-elsewhere read matters here, so an empty strict result must let the
  // follow-up through regardless of what the display list would have said.
  it('does NOT refuse a follow-up when the strict busy-elsewhere read is empty', async () => {
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce([]);
    await handle(ws, msg(), 'admin');
    expect(runs.startRun).toHaveBeenCalledOnce();
    expect(bc.send).not.toHaveBeenCalledWith(ws, expect.objectContaining({ reason: 'live-elsewhere' }));
    expect(cvLiveness.refreshLivenessSnapshot).not.toHaveBeenCalled();
  });

  // readBusyElsewhereSessionIds() itself subtracts THIS process's own
  // threads (server/canvas/cv-liveness.ts's `own = runningSessionIds()`) —
  // a session genuinely busy here never shows up in its result. The mock
  // reflects that real behavior (empty), not a hypothetical false positive.
  it('a session already busy in THIS process still passes the registry guard and routes to routeSend', async () => {
    reg.threads.set('k1', { handle: { kill: vi.fn() }, sessionId: 's1' });
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce([]);
    await handle(ws, msg(), 'admin');
    expect(runs.routeSend).toHaveBeenCalledOnce();
    expect(runs.startRun).not.toHaveBeenCalled();
    expect(bc.send).not.toHaveBeenCalledWith(ws, expect.objectContaining({ reason: 'live-elsewhere' }));
  });

  // BLOCKER (3rd review) #1 — regression: startRun (server/ws/runs.ts)
  // redirects a message targeting the Orchestrator's OWN live session into
  // its tmux pane (deliverToOrchestratorPane) instead of spawning a run —
  // that session is busy in the registry (an interactive claude) almost the
  // entire time it's working. Without this exemption the guard rejected
  // every message to the Orchestrator while it was busy, making it
  // unreachable from the Deck/dock exactly when Samuel needs to interrupt it.
  it('does not reject the Orchestrator\'s own pane target, and never even reads the registry for it', async () => {
    runs.orchestratorPaneTarget.mockReturnValueOnce({ name: 'orch', sessionId: 's1', tmux: 'cockpit-orchestrator:@1.%1' });
    await handle(ws, msg(), 'admin');
    expect(cvLiveness.readBusyElsewhereSessionIds).not.toHaveBeenCalled();
    expect(bc.send).not.toHaveBeenCalledWith(ws, expect.objectContaining({ reason: 'live-elsewhere' }));
    expect(runs.startRun).toHaveBeenCalledOnce(); // startRun itself does the pane redirect
  });

  it('still rejects a busy NON-orchestrator cv worker (the exemption is narrow)', async () => {
    runs.orchestratorPaneTarget.mockReturnValueOnce(undefined);
    cvLiveness.readBusyElsewhereSessionIds.mockResolvedValueOnce(['s1']);
    await handle(ws, msg(), 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ reason: 'live-elsewhere' }));
    expect(runs.startRun).not.toHaveBeenCalled();
  });

  // BLOCKER (3rd review) #2 — race: the awaited registry read used to sit
  // AFTER resolveThreadKey/the liveKey check, so two 'send's for the same
  // session a few ms apart could both see no liveKey, both await, and both
  // fall through to startRun — the second call's admission then REPLACES
  // (kills) the thread the first call just created. Moving the await BEFORE
  // resolveThreadKey makes resolveThreadKey→liveKey-check→startRun/routeSend
  // one synchronous block again: whichever call's await resolves LAST always
  // sees the OTHER's thread already registered and gets queued instead.
  it('two concurrent sends for the same session: the second is routed/queued, never a replacing startRun', async () => {
    // Mirrors the real admission side effect (server/ws/threads.ts): startRun
    // registers the thread synchronously before this mock returns.
    runs.startRun.mockImplementation((o: { sessionKey: string }) => {
      reg.threads.set(o.sessionKey, { handle: { kill: vi.fn() } });
    });
    let resolveFirst: (v: string[]) => void = () => {};
    let resolveSecond: (v: string[]) => void = () => {};
    cvLiveness.readBusyElsewhereSessionIds
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; }));

    const p1 = handle(ws, msg(), 'admin');
    const p2 = handle(ws, msg(), 'admin');
    // Both calls have two awaits ahead of readBusyElsewhereSessionIds
    // (resolveSkillDeny, hasInteractiveClaude) — a macrotask flush lets
    // BOTH actually reach it and swap resolveFirst/resolveSecond in for the
    // no-op placeholders before either is invoked; calling them any earlier
    // would resolve the placeholder, not the real pending promise, and hang.
    await new Promise((r) => setTimeout(r, 0));
    // Let the FIRST call's registry read resolve and fully run its
    // synchronous resolveThreadKey→startRun tail before the second one does.
    resolveFirst([]);
    await p1;
    resolveSecond([]);
    await p2;

    expect(runs.startRun).toHaveBeenCalledOnce();
    expect(runs.routeSend).toHaveBeenCalledOnce();
  });
});

describe('canvas-get — cv-live reply is a fresh read, not the periodic loop\'s cache', () => {
  it('sends cv-live built from THIS call\'s refreshLivenessSnapshot(), not a stale cached value', async () => {
    cvLiveness.refreshLivenessSnapshot.mockResolvedValueOnce({ live: ['s9'], busyElsewhere: ['s9'], idle: ['s8'] });
    await handle(ws, { t: 'canvas-get' } as ClientMsg);
    expect(cvLiveness.refreshLivenessSnapshot).toHaveBeenCalledOnce();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'cv-live', sessionIds: ['s9'], idleSessionIds: ['s8'] });
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

  it('rejects a cron without a numeric createdAt (an interval cron would never fire)', async () => {
    await handle(ws, { t: 'cron-save', cron: { id: 'c1', name: 'n', prompt: 'p', schedule: { kind: 'interval', everyMinutes: 60 }, enabled: true } } as unknown as ClientMsg);
    expect(crons.saveCron).not.toHaveBeenCalled();
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

describe('canvas-card-fork (session-reuse.ts "fork")', () => {
  beforeEach(() => {
    parked.addParked.mockReturnValue({ id: 'pk-1' });
    runs.runParkedInBackground.mockReturnValue({ forkId: 'f1' });
    parked.parkedView.mockReturnValue([]);
  });

  const msg = (over: Partial<ClientMsg> = {}): ClientMsg => ({
    t: 'canvas-card-fork', parentSessionId: 'parent-1', cardId: 'card-1', text: 'siga daqui', ...over,
  } as ClientMsg);

  it('parks then fires in background WITHOUT attaching parent-queue recovery, answering the caller with the real forkId', async () => {
    await handle(ws, msg(), 'admin');
    expect(parked.addParked).toHaveBeenCalledWith('parent-1', expect.objectContaining({ prompt: 'siga daqui', resumeId: 'parent-1' }));
    // attachRecovery=false (5th arg): a dead fork must never requeue this
    // card's prompt into the PARENT session's own queue (review #597 point 1).
    // enforceHardCtxCap=true (6th arg): review #597 point 2.
    expect(runs.runParkedInBackground).toHaveBeenCalledWith('parent-1', 'pk-1', 'admin', undefined, false, true);
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'canvas-card-fork-ok', cardId: 'card-1', parentSessionId: 'parent-1', forkId: 'f1' });
    expect(bc.broadcast).toHaveBeenCalledWith(expect.objectContaining({ t: 'queue' }));
    expect(parked.removeParked).not.toHaveBeenCalled();
  });

  it('a parking rejection never reaches runParkedInBackground', async () => {
    parked.addParked.mockReturnValue({ reject: 'fila-cheia' } as never);
    await handle(ws, msg(), 'admin');
    expect(runs.runParkedInBackground).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'canvas-card-fork-reject', cardId: 'card-1', parentSessionId: 'parent-1' }));
  });

  // The whole point of #597 point 1: a rejection must never leave the item
  // parked under the PARENT session — the passive drainer would later fire it
  // as the parent's own next turn, silently running another card's prompt on
  // the wrong session. Covers both reject shapes runParkedInBackground can
  // return: pre-take (item still parked) and 'falhou' (item unshifted back).
  it.each(['sem-contexto', 'sem-quota', 'sem-slot', 'falhou', 'ctx-grande'] as const)(
    'a background-run rejection (%s) removes the item from the parent queue instead of leaving it for the passive drainer',
    async (reject) => {
      runs.runParkedInBackground.mockReturnValue({ reject } as never);
      await handle(ws, msg(), 'admin');
      expect(parked.removeParked).toHaveBeenCalledWith('parent-1', 'pk-1', 'admin');
      expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'canvas-card-fork-reject', cardId: 'card-1' }));
      expect(bc.broadcast).toHaveBeenCalledWith(expect.objectContaining({ t: 'queue' }));
    },
  );

  // review #597 point 2: a fork target the ranking's own DEFAULT picked (not
  // necessarily a session the user sized up themselves) must respect the
  // hard ctx cap — never waved through as "explicit intent" the way a manual
  // queue click is.
  it('ctx-grande gets its own message, distinct from sem-quota', async () => {
    runs.runParkedInBackground.mockReturnValue({ reject: 'ctx-grande' } as never);
    await handle(ws, msg(), 'admin');
    const call = bc.send.mock.calls.find((c) => c[1]?.t === 'canvas-card-fork-reject');
    expect(call?.[1].message).toMatch(/grande demais/);
  });
});

// review #597 follow-up point 2: this is a SEPARATE code path from
// 'canvas-term-stats' on purpose — it must never call collectTermStats (the
// one that owns the per-socket CPU sample store) or touch broadcast/
// areaUsage, both of which only make sense for the window poller.
describe('canvas-ctx-stats (session-reuse.ts pool lookup)', () => {
  it('calls collectCtxOnly, never collectTermStats, and answers only this socket', async () => {
    termStats.collectCtxOnly.mockResolvedValue({ 's-1': { contextTokens: 4000 } });
    await handle(ws, { t: 'canvas-ctx-stats', sessions: ['s-1'] } as ClientMsg, 'admin');
    expect(termStats.collectCtxOnly).toHaveBeenCalledWith(['s-1']);
    expect(termStats.collectTermStats).not.toHaveBeenCalled();
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'canvas-ctx-stats', stats: { 's-1': { contextTokens: 4000 } } });
    expect(bc.broadcast).not.toHaveBeenCalled();
  });

  it('drops non-string entries instead of forwarding a malformed sessions array', async () => {
    await handle(ws, { t: 'canvas-ctx-stats', sessions: ['ok', 42, null] } as unknown as ClientMsg, 'admin');
    expect(termStats.collectCtxOnly).toHaveBeenCalledWith(['ok']);
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

describe('ctx-open / skill-open with an unknown id', () => {
  it('answers with an error instead of leaving the UI waiting', async () => {
    const { readContext } = await import('../contexts');
    const { readSkill } = await import('../skills');
    vi.mocked(readContext).mockResolvedValueOnce(null as never);
    vi.mocked(readSkill).mockResolvedValueOnce(null as never);
    await handle(ws, { t: 'ctx-open', id: 'nope' } as ClientMsg, 'admin');
    await handle(ws, { t: 'skill-open', id: 'nope' } as ClientMsg, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'contexto não encontrado' });
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'skill não encontrada' });
  });
});
