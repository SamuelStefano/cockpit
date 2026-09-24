import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flowMarker, type CanvasFlow } from '../../shared/canvas';
import type { TurnClosed } from './turn-hooks';

// --- mocks for every impure dependency flows.ts reaches out to --------------
// vi.mock factories below are hoisted above these — vi.hoisted keeps the
// state they close over from throwing a TDZ error at import time.

const {
  mockThreads, admit, startRunMock, isDrainerEnabledMock, resolveThreadKeyMock, addParkedMock, removeParkedMock, enqueuePendingMock,
  resumableIdMock, broadcastMock, emitCanvasMsgMock, listContextsMock, listSessionsMock, listArchivedMock, cardIdFromRefsCacheMock,
  blockedAreaForMock, runParkedInBackgroundMock, hasInteractiveClaudeMock, busyElsewhereMock, orchestratorPaneTargetMock,
} = vi.hoisted(() => {
  const mockThreads = new Map<string, { sessionId?: string }>();
  const admit = { next: true }; // controls whether the mocked startRun "admits" (threads.set) or refuses
  return {
    mockThreads, admit,
    startRunMock: vi.fn((o: { sessionKey: string }) => { if (admit.next) mockThreads.set(o.sessionKey, {}); }),
    isDrainerEnabledMock: vi.fn(() => false),
    resolveThreadKeyMock: vi.fn((id: string) => (mockThreads.has(id) ? id : undefined)),
    addParkedMock: vi.fn(() => ({ id: 'pk-1' }) as { id: string } | { reject: string }),
    removeParkedMock: vi.fn(),
    enqueuePendingMock: vi.fn(() => true),
    resumableIdMock: vi.fn((id?: string) => id),
    broadcastMock: vi.fn(),
    emitCanvasMsgMock: vi.fn(),
    listContextsMock: vi.fn(async () => [] as { id: string; title: string; description: string; mtime: number }[]),
    listSessionsMock: vi.fn(async () => [] as { id: string; title: string; snippet: string; mtime: number }[]),
    listArchivedMock: vi.fn(async () => [] as { id: string; title: string; snippet: string; mtime: number }[]),
    cardIdFromRefsCacheMock: vi.fn(async (_id: string) => undefined as string | undefined),
    blockedAreaForMock: vi.fn((_id?: string) => undefined as string | undefined),
    runParkedInBackgroundMock: vi.fn(() => ({ forkId: 'fork-1' }) as { forkId: string } | { reject: string }),
    hasInteractiveClaudeMock: vi.fn(async (_id: string) => false),
    busyElsewhereMock: vi.fn(async () => [] as string[]),
    orchestratorPaneTargetMock: vi.fn((_id?: string, _role?: string) => undefined as unknown),
  };
});

vi.mock('../ws/runs', () => ({
  startRun: (o: unknown) => startRunMock(o as never),
  isDrainerEnabled: () => isDrainerEnabledMock(),
  runParkedInBackground: (...a: unknown[]) => runParkedInBackgroundMock(...(a as [])),
  orchestratorPaneTarget: (id?: string, role?: string) => orchestratorPaneTargetMock(id, role),
}));
vi.mock('../ws/threads', () => ({
  threads: mockThreads,
  resolveThreadKey: (id: string) => resolveThreadKeyMock(id),
}));
vi.mock('../ws/parked', () => ({
  addParked: (...a: unknown[]) => addParkedMock(...(a as [])),
  removeParked: (...a: unknown[]) => removeParkedMock(...(a as [])),
}));
vi.mock('../ws/pending', () => ({ enqueuePending: (...a: unknown[]) => enqueuePendingMock(...(a as [])) }));
vi.mock('../ws/resume', () => ({ resumableId: (id?: string) => resumableIdMock(id) }));
vi.mock('../ws/broadcast', () => ({ broadcast: (m: unknown) => broadcastMock(m) }));
vi.mock('../ws/canvas-clients', () => ({ emitCanvasMsg: (m: unknown) => emitCanvasMsgMock(m) }));
vi.mock('../contexts', () => ({ listContexts: () => listContextsMock() }));
vi.mock('../sessions/index', () => ({ listSessions: () => listSessionsMock(), listArchived: () => listArchivedMock() }));
vi.mock('./index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./index')>()),
  cardIdFromRefsCache: (id: string) => cardIdFromRefsCacheMock(id),
}));
vi.mock('./autopause-loop', () => ({ blockedAreaFor: (...a: unknown[]) => blockedAreaForMock(...(a as [])) }));
vi.mock('./term-stats', () => ({ hasInteractiveClaude: (id: string) => hasInteractiveClaudeMock(id) }));
vi.mock('./cv-liveness', () => ({ readBusyElsewhereSessionIds: () => busyElsewhereMock() }));

import { __resetCardSessions, bindCardSession, cardIdForSession } from './card-sessions';
import { sanitizeCard, sanitizeFlow, updateBoard, upsertCard, upsertFlow } from './board';
import { __resetFlowRuns, activeFlowRuns, registerFlowRun } from './flow-runs';
import {
  AREA_BLOCKED_BACKOFF_MAX_MS, BACKOFF_BASE_MS, BACKOFF_MAX_MS, FLOW_RATE_LIMIT_MS, MAX_HOPS,
  backedOff, backoffMs, buildFlowPrompt, deliverToCard, deliverToSession, fillTemplate, fireFlow,
  flowResult, handleTurnClosed, hopOfPrompt, neutralizeMarkers, rateLimited, selectFlowsToFire,
} from './flows';

function flow(over: Partial<CanvasFlow> = {}): CanvasFlow {
  return { id: 'abcd', from: 's:src', to: 'k:dst', template: '', enabled: true, createdAt: 0, fires: 0, ...over };
}

// Two handleTurnClosed calls in the same test run land milliseconds apart —
// well inside the 60s cooldown claimFlowFire enforces. Tests that fire the
// SAME flow twice on purpose reset it first, same as waiting out the window.
async function clearRateLimit(id: string): Promise<void> {
  await updateBoard((b) => ({ ...b, flows: b.flows.map((f) => (f.id === id ? { ...f, lastFiredAt: undefined } : f)) }));
}

beforeEach(() => {
  process.env.COCKPIT_CANVAS_BOARD = join(mkdtempSync(join(tmpdir(), 'canvas-flows-')), 'b.json');
  mockThreads.clear();
  admit.next = true;
  __resetCardSessions();
  __resetFlowRuns();
  for (const m of [
    startRunMock, isDrainerEnabledMock, resolveThreadKeyMock, addParkedMock, removeParkedMock, enqueuePendingMock, resumableIdMock,
    broadcastMock, emitCanvasMsgMock, listContextsMock, listSessionsMock, listArchivedMock, cardIdFromRefsCacheMock,
    blockedAreaForMock, runParkedInBackgroundMock, hasInteractiveClaudeMock, busyElsewhereMock, orchestratorPaneTargetMock,
  ]) m.mockClear();
  isDrainerEnabledMock.mockReturnValue(false);
  resumableIdMock.mockImplementation((id?: string) => id);
  addParkedMock.mockReturnValue({ id: 'pk-1' });
  enqueuePendingMock.mockReturnValue(true);
  blockedAreaForMock.mockReturnValue(undefined);
  runParkedInBackgroundMock.mockReturnValue({ forkId: 'fork-1' });
  hasInteractiveClaudeMock.mockResolvedValue(false);
  busyElsewhereMock.mockResolvedValue([]);
  orchestratorPaneTargetMock.mockReturnValue(undefined);
});

// --- pure functions -----------------------------------------------------------

describe('hopOfPrompt', () => {
  it('reads the hop out of the LAST flow marker, ignoring an earlier echoed one', () => {
    const echoedThenReal = `resultado citou ${flowMarker('other', 9)} por acaso\n\nfaça algo\n\n${flowMarker('abcd', 3)}`;
    expect(hopOfPrompt(echoedThenReal)).toBe(3);
  });

  it('defaults to 0 when there is no marker, or a malformed one', () => {
    expect(hopOfPrompt('sem marcador')).toBe(0);
    expect(hopOfPrompt('[deck-flow:abcd:-1]')).toBe(0);
  });
});

describe('rateLimited', () => {
  it('blocks a flow fired less than 60s ago and lets an older one through', () => {
    expect(rateLimited({ lastFiredAt: 1000 }, 1000 + FLOW_RATE_LIMIT_MS - 1)).toBe(true);
    expect(rateLimited({ lastFiredAt: 1000 }, 1000 + FLOW_RATE_LIMIT_MS)).toBe(false);
    expect(rateLimited({ lastFiredAt: undefined }, 999999)).toBe(false);
  });
});

describe('backoffMs / backedOff', () => {
  it('climbs exponentially from the 1-minute base, capped at 30 minutes for a normal (non-area) failure', () => {
    expect(backoffMs(0)).toBe(0);
    expect(backoffMs(1)).toBe(BACKOFF_BASE_MS);
    expect(backoffMs(2)).toBe(BACKOFF_BASE_MS * 2);
    expect(backoffMs(3)).toBe(BACKOFF_BASE_MS * 4);
    expect(backoffMs(20)).toBe(BACKOFF_MAX_MS); // way past the ceiling: clamped
  });

  it('caps at 2 minutes for an area-blocked failure, far below the normal 30-minute ceiling once the streak climbs', () => {
    expect(backoffMs(1, true)).toBe(BACKOFF_BASE_MS); // 1m: same as normal at streak 1, nothing to cap yet
    expect(backoffMs(3, true)).toBe(AREA_BLOCKED_BACKOFF_MAX_MS); // normal curve would be 4m here; capped at 2m
    expect(backoffMs(20, true)).toBe(AREA_BLOCKED_BACKOFF_MAX_MS);
  });

  it('backedOff reads the flow\'s own lastFailAreaBlocked to pick the right cap', () => {
    const normal = { failStreak: 3, lastFailedAt: 1000 };
    const areaBlocked = { failStreak: 3, lastFailedAt: 1000, lastFailAreaBlocked: true };
    // At 3 minutes after the failure: still backed off under the normal 4m
    // curve, but already clear under the area-blocked 2m cap.
    const threeMinLater = 1000 + 3 * 60_000;
    expect(backedOff(normal, threeMinLater)).toBe(true);
    expect(backedOff(areaBlocked, threeMinLater)).toBe(false);
  });
});

describe('neutralizeMarkers / flowResult', () => {
  it('re-exports the shared neutralizer and folds it into flowResult', () => {
    expect(neutralizeMarkers('[deck-flow:x:1]')).toBe('(deck-flow:x:1]');
  });

  it('keeps the whole text under the cap, only the tail past it, and de-fangs echoed markers', () => {
    expect(flowResult('curto')).toBe('curto');
    const long = 'x'.repeat(13_000);
    expect(flowResult(long)).toBe(long.slice(-12_000));
    expect(flowResult('olha [deck-card:x] e [deck-flow:y:1]')).toBe('olha (deck-card:x] e (deck-flow:y:1]');
  });
});

describe('fillTemplate', () => {
  it('substitutes {{result}} in place', () => {
    expect(fillTemplate('antes {{result}} depois', 'R')).toBe('antes R depois');
  });

  it('appends the result when the template has no placeholder', () => {
    expect(fillTemplate('faça algo', 'R')).toBe('faça algo\n\nR');
  });

  it('falls back to the default template when blank', () => {
    expect(fillTemplate('   ', 'R')).toContain('R');
    expect(fillTemplate('', 'R')).toContain('Continue a partir do resultado');
  });
});

describe('buildFlowPrompt', () => {
  it('appends the hop marker for this flow', () => {
    const p = buildFlowPrompt(flow({ id: 'xyz1', template: '{{result}}' }), 'R', 2);
    expect(p).toBe(`R\n\n${flowMarker('xyz1', 2)}`);
  });
});

describe('selectFlowsToFire', () => {
  const base = { ok: true, sessionId: 'src', prompt: '', unattended: false };

  it('fires nothing when the turn did not close ok, or was unattended (cron/marathon)', () => {
    expect(selectFlowsToFire({ ...base, ok: false }, [flow()], 0)).toEqual([]);
    expect(selectFlowsToFire({ ...base, unattended: true }, [flow()], 0)).toEqual([]);
  });

  it('matches the source session and stamps hop = 1 for a turn with no marker', () => {
    expect(selectFlowsToFire(base, [flow()], 0)).toEqual([{ flow: flow(), hop: 1 }]);
  });

  it('ignores a disabled flow, a flow from a different source, and a rate-limited one', () => {
    expect(selectFlowsToFire(base, [flow({ enabled: false })], 0)).toEqual([]);
    expect(selectFlowsToFire(base, [flow({ from: 's:other' })], 0)).toEqual([]);
    expect(selectFlowsToFire(base, [flow({ lastFiredAt: 1000 })], 30_000)).toEqual([]);
  });

  it('matches a card-sourced flow by direct marker, and by a resolved boundCardId when the prompt carries none', () => {
    const cardFlow = flow({ from: 'k:card1' });
    expect(selectFlowsToFire(base, [cardFlow], 0)).toEqual([]);
    const withMarker = { ...base, prompt: 'trabalho [deck-card:card1]' };
    expect(selectFlowsToFire(withMarker, [cardFlow], 0)).toEqual([{ flow: cardFlow, hop: 1 }]);
    const withBinding = { ...base, boundCardId: 'card1' };
    expect(selectFlowsToFire(withBinding, [cardFlow], 0)).toEqual([{ flow: cardFlow, hop: 1 }]);
  });

  it('uses the LAST card marker in the prompt, not an earlier echoed one', () => {
    const cardFlow = flow({ from: 'k:real' });
    const withEcho = { ...base, prompt: 'resultado citou [deck-card:echoed] por acaso\n\n[deck-card:real]' };
    expect(selectFlowsToFire(withEcho, [cardFlow], 0)).toEqual([{ flow: cardFlow, hop: 1 }]);
  });

  it('bumps the hop from the incoming marker; hop === MAX_HOPS still fires, hop > MAX_HOPS is blocked', () => {
    const atCapMinusOne = { ...base, prompt: flowMarker('other', MAX_HOPS - 1) };
    expect(selectFlowsToFire(atCapMinusOne, [flow()], 0)).toEqual([{ flow: flow(), hop: MAX_HOPS }]);
    const atCap = { ...base, prompt: flowMarker('other', MAX_HOPS) };
    expect(selectFlowsToFire(atCap, [flow()], 0)).toEqual([]);
  });

  it('fires nothing when the turn carries neither a matching sessionId nor a card marker/binding', () => {
    expect(selectFlowsToFire({ ok: true, sessionId: undefined, prompt: 'oi', unattended: false }, [flow()], 0)).toEqual([]);
  });
});

// --- handler-level: delivery, claiming, and the turn-closed entry point -----

describe('deliverToSession', () => {
  it('a flow into the Orchestrator pane counts as delivered (startRun → pane, no thread)', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    orchestratorPaneTargetMock.mockReturnValueOnce({ termId: 'orch' });
    startRunMock.mockReturnValueOnce('pane' as never);
    await expect(deliverToSession('sess-1', 'prompt', { role: 'admin' }, flow(), 1)).resolves.toEqual({ delivered: true });
  });

  it('does not start a second writer on a session a pane or the other process is running', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    hasInteractiveClaudeMock.mockResolvedValueOnce(true);
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: false });
    busyElsewhereMock.mockResolvedValueOnce(['sess-1']);
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: false });
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('returns delivered: false when the target transcript is gone (resumableId undefined)', async () => {
    resumableIdMock.mockReturnValue(undefined);
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: false });
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('not live: starts a fresh run with bypass forced false and mcps defaulted to empty, regardless of the source params', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    const r = await deliverToSession('sess-1', 'prompt', { bypass: true, mcps: ['everything'], role: 'admin', mode: 'acceptEdits' }, flow(), 1);
    expect(r).toEqual({ delivered: true });
    expect(startRunMock).toHaveBeenCalledWith(expect.objectContaining({ sessionKey: 'sess-1', bypass: false, mcps: [] }));
  });

  it('carries the flow hop onto the new Thread (flowHop) so a later crash-resume of THIS turn does not reset the chain depth to 0', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    await deliverToSession('sess-1', 'prompt', {}, flow(), 3);
    expect(startRunMock).toHaveBeenCalledWith(expect.objectContaining({ flowHop: 3 }));
  });

  it('a flow can opt a target INTO a specific mode/mcps, but never into bypass', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    await deliverToSession('sess-1', 'prompt', { bypass: true }, flow({ mode: 'acceptEdits', mcps: ['dfl-mcp'] }), 1);
    expect(startRunMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'acceptEdits', mcps: ['dfl-mcp'], bypass: false }));
  });

  it('startRun admission refused (threads never got the key): reports failure', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    admit.next = false;
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: false });
  });

  it('live in this process + drainer enabled: parks the item (addParked)', async () => {
    mockThreads.set('sess-1', {});
    resolveThreadKeyMock.mockReturnValue('sess-1');
    isDrainerEnabledMock.mockReturnValue(true);
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: true });
    expect(addParkedMock).toHaveBeenCalled();
    expect(enqueuePendingMock).not.toHaveBeenCalled();
  });

  it('live in this process + NO drainer here: uses the in-process pending queue instead of addParked', async () => {
    mockThreads.set('sess-1', {});
    resolveThreadKeyMock.mockReturnValue('sess-1');
    isDrainerEnabledMock.mockReturnValue(false);
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: true });
    expect(enqueuePendingMock).toHaveBeenCalled();
    expect(addParkedMock).not.toHaveBeenCalled();
  });

  // Review #595 second pass, point 2: a blocked area must refuse a NEW
  // unattended turn (fireFlow's caller then arms the backoff, same as any
  // other failed delivery), but must NOT block queueing behind a session
  // that's already live — that's attended, same as a user reply.
  it('area admission blocked: refuses to start a NEW turn, and reports which area', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    blockedAreaForMock.mockReturnValue('deck');
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: false, areaBlocked: 'deck' });
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('area admission blocked does NOT stop queueing behind an already-live session', async () => {
    mockThreads.set('sess-1', {});
    resolveThreadKeyMock.mockReturnValue('sess-1');
    blockedAreaForMock.mockReturnValue('deck');
    await expect(deliverToSession('sess-1', 'prompt', {}, flow(), 1)).resolves.toEqual({ delivered: true });
    expect(enqueuePendingMock).toHaveBeenCalled();
  });
});

describe('deliverToCard', () => {
  it('returns delivered: false for an unknown card, without starting a run', async () => {
    await expect(deliverToCard('nope', flow(), 'result', 1, {})).resolves.toEqual({ delivered: false });
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('area admission blocked (a bound session sits in a blocked area): refuses without starting a run, and reports which area', async () => {
    const card = sanitizeCard({ id: 'card1', title: 'Título' }, undefined, 1)!;
    await updateBoard((b) => upsertCard(b, card));
    listSessionsMock.mockResolvedValue([{ id: 'bound-sess', title: 't', snippet: 's', mtime: 1 }]);
    const boundCard = { ...card, sessionIds: ['bound-sess'] };
    await updateBoard((b) => upsertCard(b, boundCard));
    blockedAreaForMock.mockReturnValue('itera');
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false, areaBlocked: 'itera' });
    expect(startRunMock).not.toHaveBeenCalled();
    expect(blockedAreaForMock).toHaveBeenCalledWith('bound-sess');
  });

  it('a card with no bound session is never blocked (nothing to check against)', async () => {
    const card = sanitizeCard({ id: 'card1', title: 'Título' }, undefined, 1)!;
    await updateBoard((b) => upsertCard(b, card));
    blockedAreaForMock.mockReturnValue('itera'); // some OTHER area is blocked; irrelevant here (no bound session to check)
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r.delivered).toBe(true);
  });

  it('starts a NEW session under a `new-<uuid>` key (client-migratable), with the result folded into the template and the card marker present, marks the card doing, and returns the runKey', async () => {
    const card = sanitizeCard({ id: 'card1', title: 'Título', prompt: 'faça isso' }, undefined, 1)!;
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow({ template: 'contexto: {{result}}' }), 'RESULTADO', 2, { bypass: true });
    expect(r.delivered).toBe(true);
    expect(r.runKey).toMatch(/^new-/);
    const call = startRunMock.mock.calls.at(-1)![0] as { sessionKey: string; prompt: string; bypass: boolean };
    expect(call.sessionKey).toBe(r.runKey);
    expect(call.prompt).toContain('RESULTADO');
    expect(call.prompt).toContain('[deck-card:card1]');
    expect(call.bypass).toBe(false);
    const board = await updateBoard((b) => b);
    expect(board.cards.find((c) => c.id === 'card1')?.status).toBe('doing');
  });

  it('admission refused: does not mark the card doing, and returns no runKey', async () => {
    const card = sanitizeCard({ id: 'card1', title: 'Título' }, undefined, 1)!;
    await updateBoard((b) => upsertCard(b, card));
    admit.next = false;
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false });
    const board = await updateBoard((b) => b);
    expect(board.cards.find((c) => c.id === 'card1')?.status).toBe('todo');
  });

  it('registers the new run in flow-runs.ts, so a reconnecting tab can learn it is live', async () => {
    const card = sanitizeCard({ id: 'card1', title: 'Título' }, undefined, 1)!;
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow({ id: 'flowX' }), 'result', 1, {});
    expect(activeFlowRuns()).toEqual([{ runKey: r.runKey, cardId: 'card1', flowId: 'flowX' }]);
  });

  it('admission refused: does NOT register a flow run', async () => {
    const card = sanitizeCard({ id: 'card1', title: 'Título' }, undefined, 1)!;
    await updateBoard((b) => upsertCard(b, card));
    admit.next = false;
    await deliverToCard('card1', flow(), 'result', 1, {});
    expect(activeFlowRuns()).toEqual([]);
  });
});

describe('deliverToCard reuse modes (#597 continue/fork)', () => {
  const SID = '11111111-1111-1111-1111-111111111111';
  const reuseCard = (mode: 'continue' | 'fork') => sanitizeCard(
    { id: 'card1', title: 'Título', prompt: 'continue isso', reuse: { mode, sessionId: SID } }, undefined, 1,
  )!;

  it('continue into the Orchestrator pane counts as delivered (no fork, no retry) and leaves the card status', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    hasInteractiveClaudeMock.mockResolvedValue(true); // its claude is interactive
    busyElsewhereMock.mockResolvedValue([SID]);       // and reads busy while it works
    orchestratorPaneTargetMock.mockReturnValue({ termId: 'orch' });
    startRunMock.mockReturnValueOnce('pane' as never);
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow({ id: 'orchf', template: '{{result}}' }), 'R', 1, {});
    expect(r.delivered).toBe(true);
    expect(runParkedInBackgroundMock).not.toHaveBeenCalled();
    // No turn-closed will ever fire for a pane delivery: the card is left as it was.
    expect((await updateBoard((b) => b)).cards.find((c) => c.id === 'card1')?.status).toBe('todo');
  });

  it('continue, target idle: sends into the existing session (startRun), never spawns a new one or parks a fork', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow({ id: 'abcd', template: 'contexto: {{result}}' }), 'RESULTADO', 2, {});
    expect(r).toEqual({ delivered: true, runKey: SID });
    expect(startRunMock).toHaveBeenCalledWith(expect.objectContaining({ sessionKey: SID, resumeId: SID, flowHop: 2 }));
    expect(addParkedMock).not.toHaveBeenCalled();
    expect(runParkedInBackgroundMock).not.toHaveBeenCalled();
    const call = startRunMock.mock.calls.at(-1)![0] as { sessionKey: string; prompt: string };
    expect(call.prompt).toContain('RESULTADO');
    expect(call.prompt).toContain('[deck-card:card1]');
    // Reuse never re-seeds contexts/sessions (buildContinuePrompt) — the
    // target session already read them on an earlier turn.
    expect(call.prompt).not.toContain('Contextos');
    expect(call.prompt).not.toContain('Sessões relacionadas');
    const board = await updateBoard((b) => b);
    expect(board.cards.find((c) => c.id === 'card1')?.status).toBe('doing');
    expect(activeFlowRuns()).toEqual([{ runKey: SID, cardId: 'card1', flowId: 'abcd' }]);
  });

  it('continue, target already running: falls back to fork instead of touching the live turn (review #597 point 4)', async () => {
    resolveThreadKeyMock.mockImplementation((id: string) => (id === SID ? SID : undefined));
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: true, runKey: 'fork-1' });
    expect(startRunMock).not.toHaveBeenCalled();
    expect(addParkedMock).toHaveBeenCalledWith(SID, expect.objectContaining({ resumeId: SID }));
    // attachRecovery=false, enforceHardCtxCap=true — same as dispatch.ts's
    // 'canvas-card-fork' handler (review #597 points 1 and 2).
    expect(runParkedInBackgroundMock).toHaveBeenCalledWith(SID, 'pk-1', undefined, undefined, false, true, 1);
  });

  // hasInteractiveClaude awaits real I/O (a /proc scan) — a user send in that
  // exact window can make the session go live AFTER the idle check passed.
  // startRun on an already-live sessionKey takes the `replacing` branch and
  // kills that fresh turn, which a background flow firing must never do.
  it('continue, race — session goes live DURING the double-writer await: re-checked right before the spawn, falls back to fork instead of killing the new turn', async () => {
    resolveThreadKeyMock.mockReturnValueOnce(undefined) // top-of-function idle check
      .mockReturnValueOnce(SID); // re-check immediately before startRun: now live
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: true, runKey: 'fork-1' });
    expect(startRunMock).not.toHaveBeenCalled();
    expect(runParkedInBackgroundMock).toHaveBeenCalled();
  });

  it('fork: area admission blocked on the PARENT session refuses (and reports areaBlocked) without parking or forking (fork used to skip this gate entirely)', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    blockedAreaForMock.mockImplementation((id) => (id === SID ? 'dfl' : undefined));
    const card = reuseCard('fork');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false, areaBlocked: 'dfl' });
    expect(addParkedMock).not.toHaveBeenCalled();
    expect(runParkedInBackgroundMock).not.toHaveBeenCalled();
  });

  it('continue, running fallback to fork: the area gate still applies (same fork path as explicit fork mode)', async () => {
    resolveThreadKeyMock.mockReturnValue(SID);
    blockedAreaForMock.mockImplementation((id) => (id === SID ? 'dfl' : undefined));
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false, areaBlocked: 'dfl' });
    expect(addParkedMock).not.toHaveBeenCalled();
  });

  it('fork mode always forks, even when the target is idle', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    const card = reuseCard('fork');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: true, runKey: 'fork-1' });
    expect(startRunMock).not.toHaveBeenCalled();
    expect(runParkedInBackgroundMock).toHaveBeenCalled();
  });

  it('fork: runParkedInBackground refusing removes the parked item and reports no delivery (review #597 point 1)', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    runParkedInBackgroundMock.mockReturnValue({ reject: 'sem-slot' });
    const card = reuseCard('fork');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false });
    expect(removeParkedMock).toHaveBeenCalledWith(SID, 'pk-1', undefined);
    expect(activeFlowRuns()).toEqual([]);
  });

  it('fork: addParked itself rejecting (queue full) never reaches runParkedInBackground or removeParked', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    addParkedMock.mockReturnValue({ reject: 'fila-cheia' });
    const card = reuseCard('fork');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false });
    expect(runParkedInBackgroundMock).not.toHaveBeenCalled();
    expect(removeParkedMock).not.toHaveBeenCalled();
  });

  it('continue, idle, but a pane is already resumed interactively: the double-writer guard refuses without starting a run', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    hasInteractiveClaudeMock.mockResolvedValue(true);
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false });
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('continue, idle, area admission blocked: refuses (reporting areaBlocked) without starting a run', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    blockedAreaForMock.mockReturnValue('dfl');
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    const r = await deliverToCard('card1', flow(), 'result', 1, {});
    expect(r).toEqual({ delivered: false, areaBlocked: 'dfl' });
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('a flow can opt a reuse target INTO a specific mode/mcps, but never into bypass (least-privilege params, same as deliverToSession)', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    const card = reuseCard('continue');
    await updateBoard((b) => upsertCard(b, card));
    await deliverToCard('card1', flow({ mode: 'acceptEdits', mcps: ['dfl-mcp'] }), 'result', 1, { bypass: true, mcps: ['everything'] });
    expect(startRunMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'acceptEdits', mcps: ['dfl-mcp'], bypass: false }));
  });
});

describe('fireFlow', () => {
  it('claims atomically BEFORE delivering, but only broadcasts canvas-flow-fired AFTER delivery actually succeeds', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    await fireFlow(f, 1, 'resultado', {});
    // The board write (the claim) happens regardless; the broadcast — which
    // the UI reads as "this flow just did something" — must not fire until
    // startRun actually admitted.
    expect(emitCanvasMsgMock).toHaveBeenCalledTimes(1);
    expect(emitCanvasMsgMock).toHaveBeenCalledWith({ t: 'canvas-flow-fired', flowId: 'abcd', at: expect.any(Number), fires: 1 });
    expect(emitCanvasMsgMock.mock.calls[0][0]).not.toHaveProperty('board');
    const board = await updateBoard((b) => b);
    expect(board.flows[0]).toMatchObject({ fires: 1 });
    expect(board.flows[0].lastFiredAt).toBeDefined();
  });

  it('a claim that fails (already fired/disabled/removed) never delivers and never broadcasts', async () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b', enabled: false }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    await fireFlow(f, 1, 'resultado', {});
    expect(emitCanvasMsgMock).not.toHaveBeenCalled();
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('a delivery that fails does NOT broadcast canvas-flow-fired (nothing actually happened)', async () => {
    resumableIdMock.mockReturnValue(undefined); // deliverToSession will fail
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fireFlow(f, 1, 'resultado', {});
    errSpy.mockRestore();
    expect(emitCanvasMsgMock.mock.calls.some((c) => (c[0] as { t: string }).t === 'canvas-flow-fired')).toBe(false);
  });

  it('restores the EXACT prior fires/lastFiredAt on a failed delivery, not just cleared — a real earlier fire must not look erased', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    await fireFlow(f, 1, 'resultado', {}); // a real, successful fire first
    const afterFirstFire = (await updateBoard((b) => b)).flows[0];
    expect(afterFirstFire.lastFiredAt).toBeDefined();
    // Push the successful fire's timestamp back past the cooldown so the
    // SECOND attempt below isn't itself refused by the normal rate limit —
    // this pushed-back value is the meaningful "prior" the rollback must
    // restore exactly (not undefined, which is what the old bug produced).
    await updateBoard((b) => ({ ...b, flows: b.flows.map((x) => (x.id === 'abcd' ? { ...x, lastFiredAt: x.lastFiredAt! - FLOW_RATE_LIMIT_MS } : x)) }));
    const pushedBack = (await updateBoard((b) => b)).flows[0];
    resumableIdMock.mockReturnValue(undefined); // now make the SECOND attempt fail
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fireFlow(pushedBack, 1, 'resultado', {});
    errSpy.mockRestore();
    const board = await updateBoard((b) => b);
    expect(board.flows[0].fires).toBe(pushedBack.fires);
    expect(board.flows[0].lastFiredAt).toBe(pushedBack.lastFiredAt);
    expect(board.flows[0].failStreak).toBe(1);
  });

  it('backs off exponentially on repeated failures and posts exactly ONE error toast for the whole streak', async () => {
    resumableIdMock.mockReturnValue(undefined);
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await fireFlow(f, 1, 'resultado', {}); // failure #1 -> failStreak 1, 1m backoff
    let board = await updateBoard((b) => b);
    expect(board.flows[0].failStreak).toBe(1);
    // Dedicated admin-only channel, not the generic keyless broadcast({t:'error'})
    // — see server/ws/canvas-clients.ts.
    const toastCount = () => emitCanvasMsgMock.mock.calls.filter((c) => (c[0] as { t: string }).t === 'canvas-flow-failed').length;
    expect(toastCount()).toBe(1);
    expect(broadcastMock.mock.calls.some((c) => (c[0] as { t: string }).t === 'error')).toBe(false);

    // Still inside the 1m backoff: claim itself is refused, no 2nd failure recorded.
    await fireFlow(board.flows[0], 1, 'resultado', {});
    board = await updateBoard((b) => b);
    expect(board.flows[0].failStreak).toBe(1);
    expect(toastCount()).toBe(1); // no new toast from a refused claim

    // Manually fast-forward past the backoff window and fail again.
    await updateBoard((b) => ({ ...b, flows: b.flows.map((x) => (x.id === 'abcd' ? { ...x, lastFailedAt: x.lastFailedAt! - 60_000 } : x)) }));
    board = await updateBoard((b) => b);
    await fireFlow(board.flows[0], 1, 'resultado', {});
    board = await updateBoard((b) => b);
    expect(board.flows[0].failStreak).toBe(2); // streak grew...
    expect(toastCount()).toBe(1); // ...but still just the ONE toast for the ongoing streak

    errSpy.mockRestore();
  });

  it('a delivery that throws counts as a failure (streak, backoff, toast), not a silent success', async () => {
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hasInteractiveClaudeMock.mockImplementationOnce(async () => { throw new Error('tmux wedged'); });
    startRunMock.mockImplementationOnce(() => { throw new Error('spawn ENOMEM'); });
    await expect(fireFlow(f, 1, 'resultado', {})).resolves.toBeUndefined();
    const board = await updateBoard((b) => b);
    expect(board.flows[0].failStreak).toBe(1);
    expect(emitCanvasMsgMock.mock.calls.some((c) => (c[0] as { t: string }).t === 'canvas-flow-failed')).toBe(true);
    errSpy.mockRestore();
  });

  it('an area-blocked failure gets its own pt message (never the generic "não conseguiu entregar") and persists lastFailAreaBlocked', async () => {
    blockedAreaForMock.mockReturnValue('deck');
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));

    await fireFlow(f, 1, 'resultado', {});
    const board = await updateBoard((b) => b);
    expect(board.flows[0].failStreak).toBe(1);
    expect(board.flows[0].lastFailAreaBlocked).toBe(true);
    const toast = emitCanvasMsgMock.mock.calls.map((c) => c[0]).find((m) => (m as { t: string }).t === 'canvas-flow-failed') as { message: string };
    expect(toast.message).toContain('Deck');
    expect(toast.message).not.toContain('não conseguiu entregar');
  });

  it('a success after an area-blocked failure clears lastFailAreaBlocked too, not just failStreak', async () => {
    blockedAreaForMock.mockReturnValue('deck');
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    await fireFlow(f, 1, 'resultado', {}); // fails, area-blocked
    let board = await updateBoard((b) => b);
    expect(board.flows[0].lastFailAreaBlocked).toBe(true);
    await updateBoard((b) => ({ ...b, flows: b.flows.map((x) => (x.id === 'abcd' ? { ...x, lastFailedAt: x.lastFailedAt! - 60_000 } : x)) }));
    blockedAreaForMock.mockReturnValue(undefined); // area recovered
    board = await updateBoard((b) => b);
    await fireFlow(board.flows[0], 1, 'resultado', {});
    board = await updateBoard((b) => b);
    expect(board.flows[0].lastFailAreaBlocked).toBeUndefined();
  });

  it('a success after a failure streak clears failStreak/lastFailedAt', async () => {
    resumableIdMock.mockReturnValue(undefined);
    const f = sanitizeFlow({ id: 'abcd', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await fireFlow(f, 1, 'resultado', {}); // fails
    errSpy.mockRestore();
    let board = await updateBoard((b) => b);
    expect(board.flows[0].failStreak).toBe(1);
    await updateBoard((b) => ({ ...b, flows: b.flows.map((x) => (x.id === 'abcd' ? { ...x, lastFailedAt: x.lastFailedAt! - 60_000 } : x)) }));
    resumableIdMock.mockImplementation((id?: string) => id); // now succeeds
    board = await updateBoard((b) => b);
    await fireFlow(board.flows[0], 1, 'resultado', {});
    board = await updateBoard((b) => b);
    // sanitizeFlow treats a falsy failStreak as "no streak" and omits the key
    // entirely on the next round-trip (board.ts), so 0 and absent are the
    // same "clean" state — not asserting the literal key presence.
    expect(board.flows[0].failStreak ?? 0).toBe(0);
    expect(board.flows[0].lastFailedAt).toBeUndefined();
  });

  it('broadcasts canvas-flow-run with the new session key for a card target, and never for a session target', async () => {
    const card = sanitizeCard({ id: 'card1', title: 'Título' }, undefined, 1)!;
    await updateBoard((b) => upsertCard(b, card));
    const cardFlow = sanitizeFlow({ id: 'abcd', from: 's:a', to: 'k:card1' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, cardFlow));
    await fireFlow(cardFlow, 1, 'resultado', {});
    const runMsg = emitCanvasMsgMock.mock.calls.map((c) => c[0]).find((m) => (m as { t: string }).t === 'canvas-flow-run') as
      { t: string; flowId: string; runKey: string; cardId: string } | undefined;
    expect(runMsg).toMatchObject({ flowId: 'abcd', cardId: 'card1' });
    expect(runMsg?.runKey).toMatch(/^new-/);

    await clearRateLimit('abcd');
    resolveThreadKeyMock.mockReturnValue(undefined);
    const sessFlow = sanitizeFlow({ id: 'bbbb', from: 's:a', to: 's:b' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, sessFlow));
    emitCanvasMsgMock.mockClear();
    await fireFlow(sessFlow, 1, 'resultado', {});
    expect(emitCanvasMsgMock.mock.calls.some((c) => (c[0] as { t: string }).t === 'canvas-flow-run')).toBe(false);
  });
});

describe('handleTurnClosed', () => {
  const base: TurnClosed = { sessionKey: 'k', sessionId: 'src', prompt: 'trabalho', text: 'resultado', params: {}, ok: true, hop: 0, unattended: false };

  it('no-ops when not ok, when unattended, or when the board has no flows', async () => {
    await handleTurnClosed({ ...base, ok: false });
    await handleTurnClosed({ ...base, unattended: true });
    await handleTurnClosed(base); // empty board
    expect(startRunMock).not.toHaveBeenCalled();
    expect(broadcastMock).not.toHaveBeenCalled();
    expect(emitCanvasMsgMock).not.toHaveBeenCalled();
  });

  it('clears any live flow-run for this exact sessionKey unconditionally — the run is over whether the turn closed ok, failed, or was unattended', async () => {
    // Unconditional means BEFORE the ok/unattended/no-flows gates, which all
    // return early — a card-target run's OWN closing turn commonly fails
    // isCleanTurnClose's stricter bar (e.g. stopped) and must still clear.
    registerFlowRun('k', 'card1', 'flowX');
    await handleTurnClosed({ ...base, ok: false });
    expect(activeFlowRuns()).toEqual([]);
  });

  it('does not clear a DIFFERENT session/card\'s live flow run', async () => {
    registerFlowRun('other-key', 'card2', 'flowY');
    await handleTurnClosed({ ...base, ok: false }); // closes 'k', not 'other-key'
    expect(activeFlowRuns()).toEqual([{ runKey: 'other-key', cardId: 'card2', flowId: 'flowY' }]);
  });

  it('fires a session-sourced flow end to end and delivers the (capped, de-fanged) result', async () => {
    resolveThreadKeyMock.mockReturnValue(undefined);
    const f = sanitizeFlow({ id: 'abcd', from: 's:src', to: 's:dst' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    await handleTurnClosed(base);
    expect(startRunMock).toHaveBeenCalledWith(expect.objectContaining({ sessionKey: 'dst', prompt: expect.stringContaining('resultado') }));
  });

  it('binds a card marker to the map for future turns, and a later markerless turn in the same session still matches by the binding', async () => {
    const f = sanitizeFlow({ id: 'abcd', from: 'k:card1', to: 's:dst' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    resolveThreadKeyMock.mockReturnValue(undefined);
    await handleTurnClosed({ ...base, prompt: 'primeiro turno [deck-card:card1]' });
    expect(startRunMock).toHaveBeenCalledTimes(1);
    startRunMock.mockClear();
    await clearRateLimit('abcd');
    // second turn, same session, no marker — must still match via the bound map
    await handleTurnClosed({ ...base, prompt: 'segundo turno, sem marcador nenhum' });
    expect(startRunMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the persisted refs cache when the in-memory binding is empty, and warms the map from it', async () => {
    const f = sanitizeFlow({ id: 'abcd', from: 'k:card1', to: 's:dst' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    resolveThreadKeyMock.mockReturnValue(undefined);
    cardIdFromRefsCacheMock.mockResolvedValue('card1');
    await handleTurnClosed({ ...base, prompt: 'sem marcador' });
    expect(cardIdFromRefsCacheMock).toHaveBeenCalledWith('src');
    expect(startRunMock).toHaveBeenCalledTimes(1);
    startRunMock.mockClear();
    cardIdFromRefsCacheMock.mockClear();
    await clearRateLimit('abcd');
    await handleTurnClosed({ ...base, prompt: 'sem marcador de novo' });
    expect(cardIdFromRefsCacheMock).not.toHaveBeenCalled(); // warmed by bindCardSession, no disk read needed
    expect(startRunMock).toHaveBeenCalledTimes(1);
  });

  it('a caller-provided binding (bindCardSession) works without ever reaching the marker path', async () => {
    const f = sanitizeFlow({ id: 'abcd', from: 'k:card1', to: 's:dst' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    resolveThreadKeyMock.mockReturnValue(undefined);
    bindCardSession('src', 'card1');
    await handleTurnClosed({ ...base, prompt: 'nada de especial' });
    expect(cardIdFromRefsCacheMock).not.toHaveBeenCalled();
    expect(startRunMock).toHaveBeenCalledTimes(1);
  });

  it('never throws out of the listener even if something inside blows up', async () => {
    resolveThreadKeyMock.mockImplementation(() => { throw new Error('boom'); });
    const f = sanitizeFlow({ id: 'abcd', from: 's:src', to: 's:dst' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(handleTurnClosed(base)).resolves.toBeUndefined();
    errSpy.mockRestore();
  });

  it('a RESUME_PROMPT turn (no marker in the text) still respects the chain depth via TurnClosed.hop, and blocks once it would exceed MAX_HOPS', async () => {
    // This is the crash-resume scenario the fix targets: the process died
    // mid-turn and runs.ts's autoResume replaced the prompt with the generic
    // RESUME_PROMPT (no [deck-flow:] marker at all), but Thread.flowHop
    // survived and is carried through as TurnClosed.hop.
    resolveThreadKeyMock.mockReturnValue(undefined);
    const f = sanitizeFlow({ id: 'abcd', from: 's:src', to: 's:dst' }, undefined, 1)!;
    await updateBoard((b) => upsertFlow(b, f));
    const RESUME_PROMPT = 'O turno anterior foi interrompido por uma falha do processo. Continue exatamente de onde parou, sem repetir o trabalho já feito.';

    // hop 4 -> next hop is 5, still <= MAX_HOPS: fires.
    await handleTurnClosed({ ...base, prompt: RESUME_PROMPT, hop: MAX_HOPS - 1 });
    expect(startRunMock).toHaveBeenCalledTimes(1);
    expect(startRunMock).toHaveBeenCalledWith(expect.objectContaining({ flowHop: MAX_HOPS }));
    startRunMock.mockClear();
    await clearRateLimit('abcd');

    // hop 5 -> next hop would be 6, past MAX_HOPS: blocked, even from a
    // markerless RESUME_PROMPT that a naive hopOfPrompt(t.prompt) read as 0.
    await handleTurnClosed({ ...base, prompt: RESUME_PROMPT, hop: MAX_HOPS });
    expect(startRunMock).not.toHaveBeenCalled();
  });

  it('warms the session→card binding on every clean close, even with zero flows on the board — a flow drawn LATER needs it already warm', async () => {
    // No flows upserted at all: handleTurnClosed's early "no flows" return
    // must not skip the (cheap, marker-only) binding step above it.
    await handleTurnClosed({ ...base, prompt: 'trabalho [deck-card:card1]' });
    expect(cardIdForSession('src')).toBe('card1');
  });
});
