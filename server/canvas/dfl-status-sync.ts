import { CARD_STATUS_TO_DFL, cardStatusFromDfl, type CanvasBoard, type CanvasCard, type CardStatus } from '../../shared/canvas';
import type { DflPointsSnapshot, DflTaskNode } from '../../shared/protocol';
import { emitCanvasMsg } from '../ws/canvas-clients';
import { runDflWrite } from '../dfl-write-runner';
import { findTaskInSnapshot } from './dfl-link';
import { setCardDflPending, setCardDflSynced, updateBoard } from './board';

// server/dfl-points-watch.ts calls this every time the cron/sync-now rewrites
// ~/.cockpit/dfl-points.json (DFL->Deck direction). ADMIN-ONLY push (same
// reasoning as canvas-flow-failed/canvas-card-status): this can fire with no
// canvas tab open at all, and must never reach the global broadcast(). No-op
// (no board write, no push) when nothing actually changed.
export async function applyDflSyncToBoard(snapshot: DflPointsSnapshot): Promise<void> {
  let changedCards: CanvasCard[] | null = null;
  const board = await updateBoard((b) => {
    const next = syncBoardFromDflSnapshot(b, snapshot, Date.now());
    if (next !== b) changedCards = next.cards;
    return next;
  });
  if (!changedCards) return;
  emitCanvasMsg({ t: 'canvas-board', board, flowRuns: [] });
}

// DFL -> Deck direction: the periodic dfl-sync read (server/dfl-sync.ts's
// cron, already filtered to the owner) is the ONLY source for this side —
// never a live query from here. Pure, tested without touching the board file.

// A DFL status change only overwrites the card's status when it happened
// AFTER the card's own last local change (`card.updatedAt`) — otherwise a
// user who just dragged the card locally would see it snap back to whatever
// DFL still had cached from before the drag. A task with no parseable
// `updated_at` (old row, or the sync ran before this field existed) never
// wins a conflict it can't prove it won — `undefined` reads as "not newer".
export function resolveDflStatusForCard(card: Pick<CanvasCard, 'updatedAt'>, task: Pick<DflTaskNode, 'rawStatus' | 'updatedAt'>): CardStatus | undefined {
  const mapped = cardStatusFromDfl(task.rawStatus);
  if (!mapped) return undefined; // no_longer_needed/blocked: no Deck equivalent, never guessed
  if (task.updatedAt === undefined || task.updatedAt <= card.updatedAt) return undefined;
  return mapped;
}

// Applies resolveDflStatusForCard to every linked card in one board pass.
// Cards with no link, or whose task vanished from the (owner-filtered)
// snapshot, are left untouched — this never invents or removes a link.
export function syncBoardFromDflSnapshot(board: CanvasBoard, snapshot: DflPointsSnapshot, now: number): CanvasBoard {
  let changed = false;
  const cards = board.cards.map((c) => {
    if (!c.dfl) return c;
    const task = findTaskInSnapshot(snapshot, c.dfl.taskId);
    if (!task) return c;
    const status = resolveDflStatusForCard(c, task);
    if (!status || status === c.status) return c;
    changed = true;
    return { ...c, status, updatedAt: now };
  });
  return changed ? { ...board, cards } : board;
}

// --- Deck -> DFL direction: push, retried with backoff -----------------------

// 1m, 3m, 9m, capped at 30m — same shape as server/canvas/flows.ts's
// backoffMs (independent constant: a task-status push and a flow delivery
// are different failure domains and must not share tuning by accident).
export const PUSH_BACKOFF_BASE_MS = 60_000;
export const PUSH_BACKOFF_MAX_MS = 30 * 60_000;
export const MAX_PUSH_ATTEMPTS = 5;
export function pushBackoffMs(attempt: number): number {
  if (attempt <= 0) return 0;
  return Math.min(PUSH_BACKOFF_MAX_MS, PUSH_BACKOFF_BASE_MS * 3 ** (attempt - 1));
}

// One generation counter per card: a NEWER pushCardDflStatus call for the
// same card supersedes whatever retry loop an older call still has pending
// (the debounce this feature needs — a fast drag-then-drag-again must not
// leave two competing pushes racing to write the LAST status). A stale
// generation's retry just gives up silently; only the newest one ever
// touches the board or the network again.
const generationByCard = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fire-and-forget: pushes `status` for `cardId`'s linked task, retrying with
// backoff up to MAX_PUSH_ATTEMPTS. Never throws — every outcome lands on the
// board (dfl.pending/dfl.error) and/or a canvas-dfl-sync-error toast, never
// blocks whatever caller triggered it (dispatch.ts's canvas-card-save,
// card-review.ts's auto-move).
export async function pushCardDflStatus(cardId: string, status: CardStatus, taskId: string): Promise<void> {
  const dflStatus = CARD_STATUS_TO_DFL[status];
  const generation = (generationByCard.get(cardId) ?? 0) + 1;
  generationByCard.set(cardId, generation);
  const superseded = () => generationByCard.get(cardId) !== generation;

  await updateBoard((b) => setCardDflPending(b, cardId, status, undefined));

  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
    if (superseded()) return;
    const r = await runDflWrite({ kind: 'task-status', taskId, status: dflStatus });
    if (superseded()) return;
    if (r.ok) {
      await updateBoard((b) => setCardDflSynced(b, cardId, Date.now()));
      return;
    }
    if (attempt === MAX_PUSH_ATTEMPTS) {
      await updateBoard((b) => setCardDflPending(b, cardId, status, r.error));
      emitCanvasMsg({ t: 'canvas-dfl-sync-error', cardId, message: `sync DFL falhou (${MAX_PUSH_ATTEMPTS}x): ${r.error}` });
      return;
    }
    await sleep(pushBackoffMs(attempt));
  }
}

// Test-only: the generation map is module-level.
export function __resetDflPushGenerationsForTest(): void {
  generationByCard.clear();
}
