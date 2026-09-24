import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

// Focused, isolated test for the 'canvas-get' case's two follow-up review
// fixes: it registers the socket as an admin-only canvas client, and its
// 'canvas-board' answer carries whatever flow runs are live right now — NOT
// a full dispatch.test.ts-style integration (that file mocks every other
// case's dependencies; canvas-get alone would need buildCanvas/readBoard/
// listSessions mocked too, which is cheaper and clearer kept separate).

const board = vi.hoisted(() => ({
  cards: [] as { id: string; status: string }[], pos: {}, flows: [] as unknown[], sessionStatus: {} as Record<string, unknown>, hiddenSessions: [] as string[],
}));
const boardMod = vi.hoisted(() => ({
  readBoardChained: vi.fn(async () => board),
  readBoard: vi.fn(async () => board),
  updateBoard: vi.fn(async (fn: (b: typeof board) => typeof board) => fn(board)),
  sanitizeCard: vi.fn(), sanitizeFlow: vi.fn(), sanitizePos: vi.fn(() => ({})),
  upsertCard: vi.fn(), upsertFlow: vi.fn(), removeCard: vi.fn(), removeFlow: vi.fn(),
  checkFlowSave: vi.fn(), mergePos: vi.fn(), MAX_FLOWS: 100, MAX_BULK_STATUS_IDS: 1000,
  // Lightweight functional mocks (not vi.fn() -> undefined): the new
  // dispatch.ts cases below assert on the RESULT these produce, not just that
  // they were called.
  sanitizeSessionStatus: vi.fn((sessionId: string, raw: { status: string }, now: number) => (
    sessionId ? { sessionId, entry: { status: raw.status, at: now } } : null
  )),
  setSessionStatus: vi.fn((b: typeof board, sessionId: string, entry: unknown) => ({ ...b, sessionStatus: { ...b.sessionStatus, [sessionId]: entry } })),
  setSessionStatusMany: vi.fn((b: typeof board, sessionIds: string[], entry: unknown) => ({
    ...b, sessionStatus: { ...b.sessionStatus, ...Object.fromEntries(sessionIds.map((id) => [id, entry])) },
  })),
  sanitizeSessionIds: vi.fn((raw: unknown) => (Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])),
  hideSessionOnBoard: vi.fn((b: typeof board, sessionId: string) => ({ ...b, hiddenSessions: [...b.hiddenSessions, sessionId] })),
  unhideAllSessionsOnBoard: vi.fn((b: typeof board) => ({ ...b, hiddenSessions: [] })),
}));
vi.mock('../canvas/board', () => boardMod);

const canvasIndex = vi.hoisted(() => ({ buildCanvas: vi.fn(async () => ({ nodes: [], edges: [], builtAt: 0 })) }));
vi.mock('../canvas/index', () => canvasIndex);

const flowRuns = vi.hoisted(() => ({ activeFlowRuns: vi.fn(() => [] as { runKey: string; cardId: string; flowId: string }[]) }));
vi.mock('../canvas/flow-runs', () => flowRuns);

vi.mock('../canvas/flows', () => ({ startCanvasFlows: vi.fn() }));

const canvasClients = vi.hoisted(() => ({ registerCanvasClient: vi.fn(), emitCanvasMsg: vi.fn() }));
vi.mock('./canvas-clients', () => canvasClients);

const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
vi.mock('./broadcast', () => bc);

import { handle } from './dispatch';

const ws = {} as WebSocket;

beforeEach(() => { vi.clearAllMocks(); });

describe("'canvas-get' — admin-only client registry + live flow runs on the board frame", () => {
  it('registers the socket as a canvas client', async () => {
    await handle(ws, { t: 'canvas-get' }, 'admin');
    expect(canvasClients.registerCanvasClient).toHaveBeenCalledWith(ws);
  });

  it('folds activeFlowRuns() into the canvas-board answer', async () => {
    flowRuns.activeFlowRuns.mockReturnValue([{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }]);
    await handle(ws, { t: 'canvas-get' }, 'admin');
    const boardMsg = bc.send.mock.calls.map((c) => c[1]).find((m: { t: string }) => m.t === 'canvas-board');
    expect(boardMsg).toMatchObject({ t: 'canvas-board', flowRuns: [{ runKey: 'new-abc', cardId: 'card1', flowId: 'flow1' }] });
  });

  it('answers with an empty flowRuns array when nothing is live', async () => {
    flowRuns.activeFlowRuns.mockReturnValue([]);
    await handle(ws, { t: 'canvas-get' }, 'admin');
    const boardMsg = bc.send.mock.calls.map((c) => c[1]).find((m: { t: string }) => m.t === 'canvas-board');
    expect(boardMsg).toMatchObject({ flowRuns: [] });
  });
});

// canvas review item 12a: a session-status move must reach every OTHER admin
// canvas tab too, not just answer the caller.
describe("'canvas-session-status' — slim broadcast to every canvas client", () => {
  it('answers the caller with the full board AND broadcasts a slim patch', async () => {
    await handle(ws, { t: 'canvas-session-status', sessionId: 'sid-1', status: 'done' }, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'canvas-board' }));
    expect(canvasClients.emitCanvasMsg).toHaveBeenCalledWith(
      expect.objectContaining({ t: 'canvas-session-status', sessionId: 'sid-1', status: 'done' }),
    );
  });

  it('rejects an empty session id without writing or broadcasting', async () => {
    await handle(ws, { t: 'canvas-session-status', sessionId: '', status: 'done' }, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'error', message: 'sessão inválida' });
    expect(canvasClients.emitCanvasMsg).not.toHaveBeenCalled();
  });
});

// canvas review item 2: "completar antigos (N)" — ONE board write for the
// whole batch, broadcast as one frame too (not one per session).
describe("'canvas-session-status-bulk' — one write, one broadcast for the whole batch", () => {
  it('applies the status to every id and broadcasts a single bulk frame', async () => {
    await handle(ws, { t: 'canvas-session-status-bulk', sessionIds: ['a', 'b', 'c'], status: 'done' }, 'admin');
    expect(boardMod.setSessionStatusMany).toHaveBeenCalledWith(expect.anything(), ['a', 'b', 'c'], expect.objectContaining({ status: 'done' }));
    expect(canvasClients.emitCanvasMsg).toHaveBeenCalledTimes(1);
    expect(canvasClients.emitCanvasMsg).toHaveBeenCalledWith(
      expect.objectContaining({ t: 'canvas-session-status-bulk', sessionIds: ['a', 'b', 'c'], status: 'done' }),
    );
  });

  it('rejects an empty selection or a bogus status without writing', async () => {
    await handle(ws, { t: 'canvas-session-status-bulk', sessionIds: [], status: 'done' }, 'admin');
    await handle(ws, { t: 'canvas-session-status-bulk', sessionIds: ['a'], status: 'not-a-status' as never }, 'admin');
    expect(boardMod.setSessionStatusMany).not.toHaveBeenCalled();
    expect(canvasClients.emitCanvasMsg).not.toHaveBeenCalled();
  });
});

describe("'canvas-session-hide' / 'canvas-session-unhide-all' — board-persisted, not per-device", () => {
  it('hide adds the id and answers with the board', async () => {
    await handle(ws, { t: 'canvas-session-hide', sessionId: 'sid-1' }, 'admin');
    expect(boardMod.hideSessionOnBoard).toHaveBeenCalledWith(expect.anything(), 'sid-1');
    expect(bc.send).toHaveBeenCalledWith(ws, expect.objectContaining({ t: 'canvas-board' }));
  });

  it('unhide-all clears the list', async () => {
    await handle(ws, { t: 'canvas-session-unhide-all' }, 'admin');
    expect(boardMod.unhideAllSessionsOnBoard).toHaveBeenCalled();
  });
});

describe("'canvas-card-save' — status change also broadcasts a slim canvas-card-status patch", () => {
  it('broadcasts when the status actually changed', async () => {
    boardMod.sanitizeCard.mockReturnValue({ id: 'c1', title: 't', status: 'review' });
    board.cards = [{ id: 'c1', status: 'doing' }];
    await handle(ws, { t: 'canvas-card-save', card: { id: 'c1', status: 'review' } as never }, 'admin');
    expect(canvasClients.emitCanvasMsg).toHaveBeenCalledWith({ t: 'canvas-card-status', cardId: 'c1', status: 'review' });
  });

  it('takes prev from the snapshot the write lands on, not a stale read', async () => {
    const fresh = { id: 'c1', status: 'doing' };
    board.cards = [fresh];
    // A stale read still carries a DFL link that a concurrent unlink already removed.
    boardMod.readBoard.mockResolvedValueOnce({ ...board, cards: [{ id: 'c1', status: 'doing', dfl: { taskId: 'gone' } }] } as never);
    boardMod.sanitizeCard.mockReturnValue({ id: 'c1', title: 't', status: 'doing' });
    await handle(ws, { t: 'canvas-card-save', card: { id: 'c1', status: 'doing' } as never }, 'admin');
    expect(boardMod.sanitizeCard).toHaveBeenCalledWith(expect.anything(), fresh, expect.any(Number));
  });

  it('does not broadcast when the status is unchanged (e.g. a title-only edit)', async () => {
    boardMod.sanitizeCard.mockReturnValue({ id: 'c1', title: 't2', status: 'doing' });
    board.cards = [{ id: 'c1', status: 'doing' }];
    await handle(ws, { t: 'canvas-card-save', card: { id: 'c1', status: 'doing' } as never }, 'admin');
    expect(canvasClients.emitCanvasMsg).not.toHaveBeenCalled();
  });
});

describe("'dfl-task-create-link' — never creates a second DFL task for a card", () => {
  it('refuses a card that is already linked, before touching DFL', async () => {
    board.cards = [{ id: 'c1', status: 'doing', dfl: { taskId: '11111111-1111-4111-8111-111111111111' } } as never];
    await handle(ws, { t: 'dfl-task-create-link', reqId: 'r1', confirm: true, cardId: 'c1', epicId: 'e', deliveryId: 'd', taskName: 'T', why: 'w', what: 'w' } as never, 'admin');
    expect(bc.send).toHaveBeenCalledWith(ws, { t: 'dfl-task-write', reqId: 'r1', ok: false, message: 'card já vinculado a uma task DFL' });
    expect(canvasIndex.buildCanvas).not.toHaveBeenCalled();
  });
});
