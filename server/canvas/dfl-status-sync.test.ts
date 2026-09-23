import { describe, it, expect } from 'vitest';
import type { CanvasBoard, CanvasCard } from '../../shared/canvas';
import type { DflPointsSnapshot, DflTaskNode } from '../../shared/protocol';
import { pushBackoffMs, resolveDflStatusForCard, syncBoardFromDflSnapshot } from './dfl-status-sync';

describe('resolveDflStatusForCard — status mapping + conflict resolution by timestamp', () => {
  const card = (updatedAt: number): Pick<CanvasCard, 'updatedAt'> => ({ updatedAt });

  it('maps the 4 known DFL statuses to their Deck equivalent', () => {
    expect(resolveDflStatusForCard(card(0), { rawStatus: 'to_do', updatedAt: 10 })).toBe('todo');
    expect(resolveDflStatusForCard(card(0), { rawStatus: 'in_progress', updatedAt: 10 })).toBe('doing');
    expect(resolveDflStatusForCard(card(0), { rawStatus: 'dev_completed', updatedAt: 10 })).toBe('review');
    expect(resolveDflStatusForCard(card(0), { rawStatus: 'done', updatedAt: 10 })).toBe('done');
  });

  it('never guesses a Deck status for a raw status with no equivalent (blocked/no_longer_needed)', () => {
    expect(resolveDflStatusForCard(card(0), { rawStatus: 'blocked', updatedAt: 10 })).toBeUndefined();
    expect(resolveDflStatusForCard(card(0), { rawStatus: 'no_longer_needed', updatedAt: 10 })).toBeUndefined();
  });

  it('applies when the DFL change is strictly newer than the card\'s last local change', () => {
    expect(resolveDflStatusForCard(card(100), { rawStatus: 'done', updatedAt: 200 })).toBe('done');
  });

  it('never applies when the DFL change is older or equal (the local edit wins)', () => {
    expect(resolveDflStatusForCard(card(200), { rawStatus: 'done', updatedAt: 200 })).toBeUndefined();
    expect(resolveDflStatusForCard(card(200), { rawStatus: 'done', updatedAt: 100 })).toBeUndefined();
  });

  it('a task with no updated_at (unparseable/missing) never wins a conflict it can\'t prove', () => {
    expect(resolveDflStatusForCard(card(0), { rawStatus: 'done', updatedAt: undefined })).toBeUndefined();
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
function boardWithLinkedCard(status: CanvasCard['status'], updatedAt: number, taskId = 't1'): CanvasBoard {
  const card: CanvasCard = {
    id: 'c1', title: 'Card', prompt: '', status, kind: 'task', contextIds: [], sessionIds: [],
    createdAt: 1, updatedAt, dfl: { taskId },
  };
  return { cards: [card], pos: {}, flows: [], budgets: {}, sessionStatus: {} };
}

describe('syncBoardFromDflSnapshot', () => {
  it('moves a linked card to the DFL-derived status when it is newer', () => {
    const board = boardWithLinkedCard('doing', 100);
    const snap = snapshotWithTask(baseTask({ rawStatus: 'done', updatedAt: 500 }));
    const out = syncBoardFromDflSnapshot(board, snap, 999);
    expect(out.cards[0].status).toBe('done');
    expect(out.cards[0].updatedAt).toBe(999);
  });

  it('leaves an unlinked card untouched', () => {
    const board: CanvasBoard = { cards: [{ id: 'c1', title: 'x', prompt: '', status: 'todo', kind: 'task', contextIds: [], sessionIds: [], createdAt: 1, updatedAt: 1 }], pos: {}, flows: [], budgets: {}, sessionStatus: {} };
    const snap = snapshotWithTask(baseTask({ rawStatus: 'done', updatedAt: 500 }));
    expect(syncBoardFromDflSnapshot(board, snap, 999)).toBe(board); // same reference: no-op, no unnecessary write
  });

  it('leaves a linked card untouched when its task vanished from the snapshot', () => {
    const board = boardWithLinkedCard('doing', 100, 'gone');
    const snap = snapshotWithTask(baseTask({ rawStatus: 'done', updatedAt: 500 }));
    expect(syncBoardFromDflSnapshot(board, snap, 999)).toBe(board);
  });

  it('never regresses a card whose local change is newer than the DFL row', () => {
    const board = boardWithLinkedCard('done', 900);
    const snap = snapshotWithTask(baseTask({ rawStatus: 'to_do', updatedAt: 100 }));
    const out = syncBoardFromDflSnapshot(board, snap, 999);
    expect(out.cards[0].status).toBe('done');
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
