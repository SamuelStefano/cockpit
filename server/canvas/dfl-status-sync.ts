import {
  CARD_STATUS_TO_DFL, cardStatusFromDfl, dflStatusIsBillableFinished, statusNeedsHumanConfirm,
  type CanvasBoard, type CanvasCard, type CardDflLink, type CardStatus,
} from '../../shared/canvas';
import type { DflPointsSnapshot, DflTaskNode } from '../../shared/protocol';
import { CONFIG } from '../config';
import { emitCanvasMsg } from '../ws/canvas-clients';
import { runDflWrite } from '../dfl-write-runner';
import { readDflSnapshot } from '../dfl-points';
import { findTaskInSnapshot } from './dfl-link';
import { setCardDflPending, setCardDflSynced, updateBoard } from './board';

// server/dfl-points-watch.ts calls this every time the cron/sync-now rewrites
// ~/.cockpit/dfl-points.json (DFL->Deck direction). ADMIN-ONLY push (same
// reasoning as canvas-flow-failed/canvas-card-status): this can fire with no
// canvas tab open at all, and must never reach the global broadcast(). No-op
// (no board write, no push) when nothing actually changed.
export async function applyDflSyncToBoard(snapshot: DflPointsSnapshot): Promise<void> {
  const changedIds: string[] = [];
  const board = await updateBoard((b) => {
    const next = syncBoardFromDflSnapshot(b, snapshot, Date.now());
    if (next !== b) {
      changedIds.length = 0;
      for (let i = 0; i < next.cards.length; i++) if (next.cards[i] !== b.cards[i]) changedIds.push(next.cards[i].id);
    }
    return next;
  });
  if (!changedIds.length) return;
  // A DFL-side change landing for a card cancels whatever Deck->DFL push was
  // still queued/retrying for it — the world moved under that push, and
  // blindly letting it complete later would overwrite what DFL now has with
  // a stale local value (review point 5).
  for (const id of changedIds) cancelPendingPush(id);
  emitCanvasMsg({ t: 'canvas-board', board, flowRuns: [] });
}

// DFL -> Deck direction: the periodic dfl-sync read (server/dfl-sync.ts's
// cron, already filtered to the owner) is the ONLY source for this side —
// never a live query from here. Pure, tested without touching the board file.

// Conflict resolution compares TWO READINGS OF THE SAME (DFL) CLOCK:
// `task.updatedAt` (work.tasks.updated_at, fresh from the snapshot) against
// `link.dflUpdatedAt` (the DFL updated_at we last recorded for this link —
// at link time, or after our own last successful push/sync). Comparing to
// the Deck card's own `updatedAt` would mix two different clocks on two
// different machines (review point 7) — a card saved locally 2 minutes ago
// is not "newer" or "older" than a DFL row updated 2 minutes ago in any
// meaningful sense, the timestamps aren't from the same source of truth.
// No recorded baseline (`dflUpdatedAt` undefined — e.g. a link created
// before this field existed) means we have nothing to compare against, so
// the first fresh DFL reading always wins once.
export function resolveDflStatusForCard(link: Pick<CardDflLink, 'dflUpdatedAt'>, task: Pick<DflTaskNode, 'rawStatus' | 'updatedAt'>): CardStatus | undefined {
  const mapped = cardStatusFromDfl(task.rawStatus);
  if (!mapped) return undefined; // no_longer_needed/blocked: no Deck equivalent, never guessed
  if (task.updatedAt === undefined) return undefined;
  if (link.dflUpdatedAt !== undefined && task.updatedAt <= link.dflUpdatedAt) return undefined;
  return mapped;
}

// Applies resolveDflStatusForCard to every linked card in one board pass.
// Cards with no link, or whose task vanished from the (owner-filtered)
// snapshot, are left untouched — this never invents or removes a link. A
// card that DOES get the DFL-derived status also gets dflUpdatedAt stamped
// (keeps the DFL-clock baseline current) and any pending/error/
// awaitingConfirm push marker cleared — DFL is now authoritative for this
// status, there is nothing left to push.
export function syncBoardFromDflSnapshot(board: CanvasBoard, snapshot: DflPointsSnapshot, now: number): CanvasBoard {
  let changed = false;
  const cards = board.cards.map((c) => {
    if (!c.dfl) return c;
    const task = findTaskInSnapshot(snapshot, c.dfl.taskId);
    if (!task) return c;
    const status = resolveDflStatusForCard(c.dfl, task);
    if (!status) return c;
    changed = true;
    return {
      ...c, status, updatedAt: now,
      dfl: { taskId: c.dfl.taskId, lastSyncedAt: c.dfl.lastSyncedAt, dflUpdatedAt: task.updatedAt },
    };
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

// Bumps the generation without starting a new push — used when a link is
// dropped (server/ws/dispatch.ts's dfl-task-unlink) or a DFL-side change
// just landed for this card (applyDflSyncToBoard above): whatever push was
// still queued/retrying must not fire anymore.
export function cancelPendingPush(cardId: string): void {
  generationByCard.set(cardId, (generationByCard.get(cardId) ?? 0) + 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TaskFingerprint { rawStatus: string; updatedAt?: number }
async function taskFingerprint(taskId: string): Promise<TaskFingerprint | undefined> {
  // Local cached read (~/.cockpit/dfl-points.json, server/dfl-points.ts) —
  // NEVER a live DFL query. Same file the periodic cron already refreshes.
  const snap = await readDflSnapshot();
  const task = snap && findTaskInSnapshot(snap, taskId);
  return task ? { rawStatus: task.rawStatus, updatedAt: task.updatedAt } : undefined;
}
function fingerprintChanged(a: TaskFingerprint | undefined, b: TaskFingerprint | undefined): boolean {
  if (!a || !b) return false; // no baseline (or no longer readable) = nothing to compare, don't block on it
  return a.rawStatus !== b.rawStatus || a.updatedAt !== b.updatedAt;
}

// Fire-and-forget: pushes `status` for `cardId`'s linked task, retrying with
// backoff up to MAX_PUSH_ATTEMPTS. Never throws — every outcome lands on the
// board (dfl.pending/dfl.error) and/or a canvas-dfl-sync-error toast, never
// blocks whatever caller triggered it (dispatch.ts's canvas-card-save,
// card-review.ts's auto-move, or the explicit confirm handler).
//
// Two INDEPENDENT reasons a push needs a human before it ever touches the
// network, either one is enough:
//  - the TARGET is review/done (statusNeedsHumanConfirm) — reaching a
//    billable/finished state in the first place.
//  - the task's CURRENT (last locally cached) DFL status is already
//    dev_completed/done (dflStatusIsBillableFinished) — REOPENING a
//    billable/finished task, e.g. dragging a Completed card back to ToDo, or
//    undoing a review, even though the target itself (to_do/in_progress)
//    carries no billing weight on its own. Without this check a card that
//    DFL (or a prior confirmed push) had already marked `done` would get
//    silently reopened the instant it moved anywhere else — possibly after
//    that work was already invoiced.
// An AUTOMATIC caller hitting either case never actually writes: it only
// arms `awaitingConfirm` and stops. Only `confirmed: true` — set exclusively
// by the explicit dfl-task-confirm-sync handler a human action drives —
// proceeds to the network.
// Every caller fires this with `void`. updateBoard rejects on a corrupt board or
// a failed write (ENOSPC), and an unhandled rejection shuts the backend down and
// kills every run, so nothing may escape from here.
export async function pushCardDflStatus(cardId: string, status: CardStatus, taskId: string, opts: { confirmed?: boolean } = {}): Promise<void> {
  try {
    await pushCardDflStatusUnsafe(cardId, status, taskId, opts);
  } catch (e) {
    console.error('[dfl-status-sync] push failed:', (e as Error).message);
    emitCanvasMsg({ t: 'canvas-dfl-sync-error', cardId, message: `sync DFL falhou: ${(e as Error).message}` });
  }
}

async function pushCardDflStatusUnsafe(cardId: string, status: CardStatus, taskId: string, opts: { confirmed?: boolean }): Promise<void> {
  // Same loopback-only gate as every other DFL write (server/ws/dispatch.ts's
  // points-dfl-change/-invoice/dfl-task-create-link): the federated agent box
  // must never talk to DFL, automatic hook or not.
  if (!CONFIG.localOnly) return;

  const generation = (generationByCard.get(cardId) ?? 0) + 1;
  generationByCard.set(cardId, generation);
  const superseded = () => generationByCard.get(cardId) !== generation;

  // Fetched once, up front: doubles as the "is this a reopen?" check below
  // AND the staleness baseline the retry loop compares against — a single
  // local-cache read (never a live DFL query) covers both.
  const baseline = await taskFingerprint(taskId);
  const reopeningFinished = dflStatusIsBillableFinished(baseline?.rawStatus);

  if ((statusNeedsHumanConfirm(status) || reopeningFinished) && !opts.confirmed) {
    await updateBoard((b) => setCardDflPending(b, cardId, status, { awaitingConfirm: true }));
    return;
  }

  await updateBoard((b) => setCardDflPending(b, cardId, status, {}));
  const dflStatus = CARD_STATUS_TO_DFL[status];

  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
    if (superseded()) return;
    // Re-read (local cache, no network) right before every attempt — if the
    // task changed since this push was queued (someone else, or our own
    // sync, moved it), abandon THIS push and let the DFL->Deck direction
    // (which already ran to produce that change) be the one source of
    // truth, instead of clobbering it with a now-stale status.
    if (fingerprintChanged(baseline, await taskFingerprint(taskId))) {
      await updateBoard((b) => setCardDflPending(b, cardId, undefined));
      return;
    }
    const r = await runDflWrite({ kind: 'task-status', taskId, status: dflStatus, unlessFinished: !opts.confirmed });
    if (superseded()) return;
    if (r.ok) {
      const updatedAt = typeof r.result.updatedAt === 'string' ? Date.parse(r.result.updatedAt) : undefined;
      await updateBoard((b) => setCardDflSynced(b, cardId, Date.now(), Number.isFinite(updatedAt) ? updatedAt : undefined));
      return;
    }
    // DFL itself says the task is finished (the local snapshot was stale): same
    // gate as the up-front reopen check — ask, don't retry.
    if (!opts.confirmed && r.error.includes('FINISHED_IN_DFL')) {
      await updateBoard((b) => setCardDflPending(b, cardId, status, { awaitingConfirm: true }));
      return;
    }
    if (attempt === MAX_PUSH_ATTEMPTS) {
      await updateBoard((b) => setCardDflPending(b, cardId, status, { error: r.error }));
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
