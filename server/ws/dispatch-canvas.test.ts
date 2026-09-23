import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebSocket } from 'ws';

// Focused, isolated test for the 'canvas-get' case's two follow-up review
// fixes: it registers the socket as an admin-only canvas client, and its
// 'canvas-board' answer carries whatever flow runs are live right now — NOT
// a full dispatch.test.ts-style integration (that file mocks every other
// case's dependencies; canvas-get alone would need buildCanvas/readBoard/
// listSessions mocked too, which is cheaper and clearer kept separate).

const board = vi.hoisted(() => ({
  cards: [] as unknown[], pos: {}, flows: [] as unknown[],
}));
const boardMod = vi.hoisted(() => ({
  readBoardChained: vi.fn(async () => board),
  readBoard: vi.fn(async () => board),
  updateBoard: vi.fn(async (fn: (b: typeof board) => typeof board) => fn(board)),
  sanitizeCard: vi.fn(), sanitizeFlow: vi.fn(), sanitizePos: vi.fn(() => ({})),
  upsertCard: vi.fn(), upsertFlow: vi.fn(), removeCard: vi.fn(), removeFlow: vi.fn(),
  checkFlowSave: vi.fn(), mergePos: vi.fn(), MAX_FLOWS: 100,
}));
vi.mock('../canvas/board', () => boardMod);

const canvasIndex = vi.hoisted(() => ({ buildCanvas: vi.fn(async () => ({ nodes: [], edges: [], builtAt: 0 })) }));
vi.mock('../canvas/index', () => canvasIndex);

const flowRuns = vi.hoisted(() => ({ activeFlowRuns: vi.fn(() => [] as { runKey: string; cardId: string; flowId: string }[]) }));
vi.mock('../canvas/flow-runs', () => flowRuns);

vi.mock('../canvas/flows', () => ({ startCanvasFlows: vi.fn() }));

const canvasClients = vi.hoisted(() => ({ registerCanvasClient: vi.fn() }));
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
