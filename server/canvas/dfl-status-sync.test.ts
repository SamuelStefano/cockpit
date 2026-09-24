import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dflStatusIsBillableFinished, type CanvasBoard, type CanvasCard, type CardDflLink } from '../../shared/canvas';
import type { DflPointsSnapshot, DflTaskNode } from '../../shared/protocol';

// --- mocks for pushCardDflStatus's impure deps -------------------------------
const { runDflWriteMock, readDflSnapshotMock, emitCanvasMsgMock, config } = vi.hoisted(() => ({
  runDflWriteMock: vi.fn(),
  readDflSnapshotMock: vi.fn(async () => null as DflPointsSnapshot | null),
  emitCanvasMsgMock: vi.fn(),
  config: { localOnly: true },
}));
vi.mock('../dfl-write-runner', () => ({ runDflWrite: (...a: unknown[]) => runDflWriteMock(...a) }));
vi.mock('../dfl-points', () => ({ readDflSnapshot: () => readDflSnapshotMock() }));
vi.mock('../ws/canvas-clients', () => ({ emitCanvasMsg: (m: unknown) => emitCanvasMsgMock(m) }));
vi.mock('../config', () => ({ CONFIG: config }));

import { readBoard, sanitizeCard, setCardDflLink, updateBoard, upsertCard } from './board';
import {
  cancelPendingPush, pushBackoffMs, pushCardDflStatus, resolveDflStatusForCard, syncBoardFromDflSnapshot,
} from './dfl-status-sync';

describe('resolveDflStatusForCard — status mapping + conflict resolution, DFL clock vs DFL clock', () => {
  const link = (dflUpdatedAt?: number): Pick<CardDflLink, 'dflUpdatedAt'> => ({ dflUpdatedAt });

  it('maps the 4 known DFL statuses to their Deck equivalent', () => {
    expect(resolveDflStatusForCard(link(0), { rawStatus: 'to_do', updatedAt: 10 })).toBe('todo');
    expect(resolveDflStatusForCard(link(0), { rawStatus: 'in_progress', updatedAt: 10 })).toBe('doing');
    expect(resolveDflStatusForCard(link(0), { rawStatus: 'dev_completed', updatedAt: 10 })).toBe('review');
    expect(resolveDflStatusForCard(link(0), { rawStatus: 'done', updatedAt: 10 })).toBe('done');
  });

  it('never guesses a Deck status for a raw status with no equivalent (blocked/no_longer_needed)', () => {
    expect(resolveDflStatusForCard(link(0), { rawStatus: 'blocked', updatedAt: 10 })).toBeUndefined();
    expect(resolveDflStatusForCard(link(0), { rawStatus: 'no_longer_needed', updatedAt: 10 })).toBeUndefined();
  });

  it('applies when the fresh DFL updated_at is strictly newer than the DFL updated_at recorded at last sync', () => {
    expect(resolveDflStatusForCard(link(100), { rawStatus: 'done', updatedAt: 200 })).toBe('done');
  });

  it('never applies when the fresh reading is older or equal to what was already recorded', () => {
    expect(resolveDflStatusForCard(link(200), { rawStatus: 'done', updatedAt: 200 })).toBeUndefined();
    expect(resolveDflStatusForCard(link(200), { rawStatus: 'done', updatedAt: 100 })).toBeUndefined();
  });

  // Compares DFL clock to DFL clock ONLY — a Deck-side card.updatedAt must
  // never enter this decision (review point 7: mixing clocks from two
  // different machines produces a meaningless comparison).
  it('a link with no recorded dflUpdatedAt (first observation) accepts the fresh DFL reading', () => {
    expect(resolveDflStatusForCard(link(undefined), { rawStatus: 'done', updatedAt: 1 })).toBe('done');
  });

  it('a task with no updated_at (unparseable/missing) never wins a conflict it can\'t prove', () => {
    expect(resolveDflStatusForCard(link(0), { rawStatus: 'done', updatedAt: undefined })).toBeUndefined();
  });
});

function baseTask(over: Partial<DflTaskNode>): DflTaskNode {
  return { id: 't1', name: 'Task', points: 1, status: 'todo', rawStatus: 'to_do', amountCents: 0, ...over };
}
function snapshotWithTask(task: DflTaskNode): DflPointsSnapshot {
  return {
    projects: [{ id: 'p1', name: 'P', points: 0, amountCents: 0, epics: [{ id: 'e1', name: 'E', status: '', points: 0, amountCents: 0, deliveries: [{ id: 'd1', name: 'D', status: '', pricePerPoint: 75, tasks: [task], points: 0, amountCents: 0 }] }] }],
    invoices: [], totals: { paidPoints: 0, paidAmountCents: 0, openPoints: 0, amountOpenCents: 0, todoPoints: 0, totalPoints: 0 },
    pricePerPoint: 75, syncedAt: 1, stale: false,
  };
}
function boardWithLinkedCard(status: CanvasCard['status'], dflUpdatedAt: number | undefined, taskId = 't1', extra: Partial<CardDflLink> = {}): CanvasBoard {
  const card: CanvasCard = {
    id: 'card-1', title: 'Card', prompt: '', status, kind: 'task', contextIds: [], sessionIds: [],
    createdAt: 1, updatedAt: 1, dfl: { taskId, ...(dflUpdatedAt !== undefined ? { dflUpdatedAt } : {}), ...extra },
  };
  return { cards: [card], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] };
}

describe('syncBoardFromDflSnapshot', () => {
  it('moves a linked card to the DFL-derived status when it is newer, and stamps the new dflUpdatedAt baseline', () => {
    const board = boardWithLinkedCard('doing', 100);
    const snap = snapshotWithTask(baseTask({ rawStatus: 'done', updatedAt: 500 }));
    const out = syncBoardFromDflSnapshot(board, snap, 999);
    expect(out.cards[0].status).toBe('done');
    expect(out.cards[0].updatedAt).toBe(999);
    expect(out.cards[0].dfl?.dflUpdatedAt).toBe(500);
  });

  it('clears pending/error/awaitingConfirm when the DFL side wins — nothing left to push', () => {
    const board = boardWithLinkedCard('doing', 100, 't1', { pending: 'doing', error: 'boom', awaitingConfirm: true });
    const snap = snapshotWithTask(baseTask({ rawStatus: 'done', updatedAt: 500 }));
    const out = syncBoardFromDflSnapshot(board, snap, 999);
    expect(out.cards[0].dfl).toEqual({ taskId: 't1', lastSyncedAt: undefined, dflUpdatedAt: 500 });
  });

  it('leaves an unlinked card untouched', () => {
    const board: CanvasBoard = { cards: [{ id: 'card-1', title: 'x', prompt: '', status: 'todo', kind: 'task', contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 1 }], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] };
    const snap = snapshotWithTask(baseTask({ rawStatus: 'done', updatedAt: 500 }));
    expect(syncBoardFromDflSnapshot(board, snap, 999)).toBe(board); // same reference: no-op, no unnecessary write
  });

  it('leaves a linked card untouched when its task vanished from the snapshot', () => {
    const board = boardWithLinkedCard('doing', 100, 'gone');
    const snap = snapshotWithTask(baseTask({ rawStatus: 'done', updatedAt: 500 }));
    expect(syncBoardFromDflSnapshot(board, snap, 999)).toBe(board);
  });

  it('never regresses a card whose recorded DFL baseline is already newer than the fresh row', () => {
    const board = boardWithLinkedCard('done', 900);
    const snap = snapshotWithTask(baseTask({ rawStatus: 'to_do', updatedAt: 100 }));
    const out = syncBoardFromDflSnapshot(board, snap, 999);
    expect(out.cards[0].status).toBe('done');
  });
});

const TASK = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  process.env.COCKPIT_CANVAS_BOARD = join(mkdtempSync(join(tmpdir(), 'canvas-dfl-push-')), 'b.json');
  runDflWriteMock.mockReset();
  readDflSnapshotMock.mockReset();
  readDflSnapshotMock.mockResolvedValue(null);
  emitCanvasMsgMock.mockClear();
  config.localOnly = true;
});

async function linkedCard(cardId: string, status: CanvasCard['status'] = 'todo'): Promise<void> {
  await updateBoard((b) => upsertCard(b, sanitizeCard({ id: cardId, title: 't', status }, undefined, 1)!));
  await updateBoard((b) => setCardDflLink(b, cardId, TASK, 1));
}

describe('pushCardDflStatus — review/done need a human, todo/doing never touch the network unconfirmed', () => {
  it('todo/doing push for real automatically (unconfirmed) on success', async () => {
    await linkedCard('card-1');
    runDflWriteMock.mockResolvedValue({ ok: true, result: { taskId: TASK, status: 'in_progress', updatedAt: '2026-09-23T00:00:00.000Z' } });
    await pushCardDflStatus('card-1', 'doing', TASK);
    expect(runDflWriteMock).toHaveBeenCalledWith({ kind: 'task-status', taskId: TASK, status: 'in_progress' });
    const board = await readBoard();
    expect(board.cards[0].dfl?.pending).toBeUndefined();
    expect(board.cards[0].dfl?.dflUpdatedAt).toBe(Date.parse('2026-09-23T00:00:00.000Z'));
  });

  it('review/done UNCONFIRMED never calls the network — only arms awaitingConfirm', async () => {
    await linkedCard('card-1');
    await pushCardDflStatus('card-1', 'review', TASK); // no confirmed flag
    expect(runDflWriteMock).not.toHaveBeenCalled();
    const board = await readBoard();
    expect(board.cards[0].dfl?.pending).toBe('review');
    expect(board.cards[0].dfl?.awaitingConfirm).toBe(true);
  });

  it('review/done UNCONFIRMED stays true even for "done" (the billable one)', async () => {
    await linkedCard('card-1');
    await pushCardDflStatus('card-1', 'done', TASK);
    expect(runDflWriteMock).not.toHaveBeenCalled();
  });

  it('review/done CONFIRMED does push for real', async () => {
    await linkedCard('card-1');
    runDflWriteMock.mockResolvedValue({ ok: true, result: { taskId: TASK, status: 'done' } });
    await pushCardDflStatus('card-1', 'done', TASK, { confirmed: true });
    expect(runDflWriteMock).toHaveBeenCalledWith({ kind: 'task-status', taskId: TASK, status: 'done' });
    const board = await readBoard();
    expect(board.cards[0].dfl?.pending).toBeUndefined();
  });
});

// Coordinator follow-up: moving a linked card OUT of a billable/finished DFL
// state (dev_completed/done) must need the SAME human confirm as reaching
// one — even though the TARGET status (to_do/in_progress) carries no billing
// weight on its own. Without this, dragging a "Completed" card back to ToDo
// silently reopened a possibly-already-invoiced DFL task.
describe('pushCardDflStatus — reopening a billable/finished DFL task needs confirm too (any target)', () => {
  it('current DFL status "done", target "todo" (unconfirmed): never touches the network, only arms awaitingConfirm', async () => {
    await linkedCard('card-1');
    readDflSnapshotMock.mockResolvedValue(snapshotWithTask(baseTask({ id: TASK, rawStatus: 'done', updatedAt: 100 })));
    await pushCardDflStatus('card-1', 'todo', TASK);
    expect(runDflWriteMock).not.toHaveBeenCalled();
    const board = await readBoard();
    expect(board.cards[0].dfl?.pending).toBe('todo');
    expect(board.cards[0].dfl?.awaitingConfirm).toBe(true);
  });

  it('current DFL status "dev_completed", target "doing" (unconfirmed): also gated', async () => {
    await linkedCard('card-1');
    readDflSnapshotMock.mockResolvedValue(snapshotWithTask(baseTask({ id: TASK, rawStatus: 'dev_completed', updatedAt: 100 })));
    await pushCardDflStatus('card-1', 'doing', TASK);
    expect(runDflWriteMock).not.toHaveBeenCalled();
    const board = await readBoard();
    expect(board.cards[0].dfl?.awaitingConfirm).toBe(true);
  });

  it('CONFIRMED reopen actually pushes (a human explicitly said so)', async () => {
    await linkedCard('card-1');
    readDflSnapshotMock.mockResolvedValue(snapshotWithTask(baseTask({ id: TASK, rawStatus: 'done', updatedAt: 100 })));
    runDflWriteMock.mockResolvedValue({ ok: true, result: { taskId: TASK, status: 'to_do' } });
    await pushCardDflStatus('card-1', 'todo', TASK, { confirmed: true });
    expect(runDflWriteMock).toHaveBeenCalledWith({ kind: 'task-status', taskId: TASK, status: 'to_do' });
    const board = await readBoard();
    expect(board.cards[0].dfl?.pending).toBeUndefined();
  });

  it('current DFL status NOT finished (to_do): a todo/doing target pushes normally, unconfirmed', async () => {
    await linkedCard('card-1');
    readDflSnapshotMock.mockResolvedValue(snapshotWithTask(baseTask({ id: TASK, rawStatus: 'to_do', updatedAt: 100 })));
    runDflWriteMock.mockResolvedValue({ ok: true, result: { taskId: TASK, status: 'in_progress' } });
    await pushCardDflStatus('card-1', 'doing', TASK);
    expect(runDflWriteMock).toHaveBeenCalledWith({ kind: 'task-status', taskId: TASK, status: 'in_progress' });
  });

  it('no local baseline at all (never synced yet): nothing to detect a reopen with, pushes normally', async () => {
    await linkedCard('card-1');
    readDflSnapshotMock.mockResolvedValue(null);
    runDflWriteMock.mockResolvedValue({ ok: true, result: { taskId: TASK, status: 'in_progress' } });
    await pushCardDflStatus('card-1', 'doing', TASK);
    expect(runDflWriteMock).toHaveBeenCalledTimes(1);
  });
});

describe('pushCardDflStatus — CONFIG.localOnly gate (review point 4)', () => {
  it('never calls the network, and never even touches the board, off the loopback box', async () => {
    await linkedCard('card-1');
    config.localOnly = false;
    await pushCardDflStatus('card-1', 'doing', TASK);
    expect(runDflWriteMock).not.toHaveBeenCalled();
    const board = await readBoard();
    expect(board.cards[0].dfl?.pending).toBeUndefined(); // untouched, not even the optimistic marker
  });
});

describe('pushCardDflStatus — stale-abort (review point 5)', () => {
  it('aborts before ever writing when the local DFL snapshot shows the task changed since the push was queued', async () => {
    await linkedCard('card-1');
    // First read (baseline, before the loop) sees to_do/100; second read (right
    // before the first attempt) sees it already moved to done/999 — as if the
    // DFL->Deck sync landed a change for this exact task while we were about
    // to push. The stale push must back off instead of clobbering it.
    readDflSnapshotMock
      .mockResolvedValueOnce(snapshotWithTask(baseTask({ id: TASK, rawStatus: 'to_do', updatedAt: 100 })))
      .mockResolvedValueOnce(snapshotWithTask(baseTask({ id: TASK, rawStatus: 'done', updatedAt: 999 })));
    await pushCardDflStatus('card-1', 'doing', TASK);
    expect(runDflWriteMock).not.toHaveBeenCalled();
    const board = await readBoard();
    expect(board.cards[0].dfl?.pending).toBeUndefined();
  });

  it('proceeds normally when there is no baseline to compare against (nothing to detect staleness with)', async () => {
    await linkedCard('card-1');
    readDflSnapshotMock.mockResolvedValue(null); // sync never ran / task not yet in cache
    runDflWriteMock.mockResolvedValue({ ok: true, result: { taskId: TASK, status: 'in_progress' } });
    await pushCardDflStatus('card-1', 'doing', TASK);
    expect(runDflWriteMock).toHaveBeenCalledTimes(1);
  });
});

describe('cancelPendingPush', () => {
  it('a push cancelled right after being queued (e.g. by an unlink) never lands its board write', async () => {
    await linkedCard('card-1');
    runDflWriteMock.mockResolvedValue({ ok: true, result: { taskId: TASK, status: 'in_progress' } });
    const p = pushCardDflStatus('card-1', 'doing', TASK);
    cancelPendingPush('card-1'); // synchronous, lands before pushCardDflStatus's own next generation check
    await p;
    const board = await readBoard();
    // Still the link-time stamp — setCardDflSynced from the now-superseded
    // call never runs, so it's never bumped to "now".
    expect(board.cards[0].dfl?.lastSyncedAt).toBe(1);
  });
});

describe('dflStatusIsBillableFinished', () => {
  it('true only for dev_completed/done — the two DFL statuses a reopen must be gated against', () => {
    expect(dflStatusIsBillableFinished('dev_completed')).toBe(true);
    expect(dflStatusIsBillableFinished('done')).toBe(true);
  });
  it('false for every other raw status, including undefined (no baseline)', () => {
    expect(dflStatusIsBillableFinished('to_do')).toBe(false);
    expect(dflStatusIsBillableFinished('in_progress')).toBe(false);
    expect(dflStatusIsBillableFinished('blocked')).toBe(false);
    expect(dflStatusIsBillableFinished('no_longer_needed')).toBe(false);
    expect(dflStatusIsBillableFinished(undefined)).toBe(false);
  });
});

describe('pushBackoffMs', () => {
  it('is 0 for the first attempt and grows 3x per retry, capped at 30 minutes', () => {
    expect(pushBackoffMs(0)).toBe(0);
    expect(pushBackoffMs(1)).toBe(60_000);
    expect(pushBackoffMs(2)).toBe(180_000);
    expect(pushBackoffMs(3)).toBe(540_000);
    expect(pushBackoffMs(10)).toBe(30 * 60_000);
  });
});

describe('pushCardDflStatus — never rejects (callers fire it with void)', () => {
  it('resolves and reports when the board cannot be written', async () => {
    const { writeFileSync } = await import('node:fs');
    await linkedCard('card-1');
    writeFileSync(process.env.COCKPIT_CANVAS_BOARD!, '{ corrupt');
    await expect(pushCardDflStatus('card-1', 'doing', TASK)).resolves.toBeUndefined();
    expect(emitCanvasMsgMock).toHaveBeenCalledWith(expect.objectContaining({ t: 'canvas-dfl-sync-error', cardId: 'card-1' }));
  });
});
