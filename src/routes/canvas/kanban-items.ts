import type { CanvasCard, CanvasEdge, CanvasNode, CardStatus } from '../../../shared/canvas';
import { boundSessions } from './canvas-board';
import { isAutomationSession } from './canvas-automation';

// A user decision stored on the board (server/canvas/board.ts sanitizes/caps
// it), keyed by session uuid. `at` is when the user made the call — the only
// thing that can undo it is the session itself moving again (see
// isOverrideActive below), never a timeout.
export interface SessionStatusOverride { status: CardStatus; at: number }

// The override only holds while nothing has happened on the session SINCE the
// user set it. `mtime` is the session's own last-activity (transcript write);
// `turnStartedAt` is set while a NEW turn is actively running (TermStats) —
// checked separately because a turn in progress hasn't touched mtime yet (the
// transcript write lands at turn CLOSE), and "the user dragged it to
// Completed, then a turn started" must leave Completed immediately, not wait
// for that turn to finish first.
export function isOverrideActive(override: SessionStatusOverride | undefined, mtime: number, turnStartedAt: number | undefined): boolean {
  if (!override) return false;
  if (mtime > override.at) return false;
  if (turnStartedAt !== undefined && turnStartedAt > override.at) return false;
  return true;
}

export interface DeriveSessionStatusInput {
  mtime: number;
  running: boolean;
  waiting: boolean; // turn stopped on a pending AskUserQuestion
  everRan: boolean; // count !== 0 — a real turn happened at least once
  override?: SessionStatusOverride;
  turnStartedAt?: number;
}

// running/waiting are read off LIVE state (phases, SessionMeta.waiting) and
// checked BEFORE the override: either one being true means a turn is
// happening right now, which is always "a new turn after the override" even
// when it hasn't finished long enough to move `mtime` past `override.at` yet
// (the transcript write lands at turn close, not at turn start). Once neither
// is true, isOverrideActive is the real expiry check. What's left after that
// is the automatic reading: never ran a turn -> ToDo (rare); otherwise the
// agent closed a turn and nobody has looked -> Done.
export function deriveSessionStatus(i: DeriveSessionStatusInput): CardStatus {
  if (i.running) return 'doing';
  if (i.waiting) return 'doing';
  if (isOverrideActive(i.override, i.mtime, i.turnStartedAt)) return i.override!.status;
  if (!i.everRan) return 'todo';
  return 'review';
}

export interface SessionKanbanItem {
  nodeId: string; // 's:<uuid>'
  sessionId: string;
  title: string;
  subtitle: string;
  status: CardStatus;
  running: boolean;
  waitingOnUser: boolean;
  mtime: number;
}

export interface DeriveSessionItemsOpts {
  nodes: CanvasNode[]; // merged.nodes (session + card nodes at least)
  edges: CanvasEdge[]; // merged.edges
  cards: CanvasCard[];
  running: Set<string>; // session uuids currently running (phases thinking/streaming)
  overrides: Record<string, SessionStatusOverride>;
  turnStartedAt: Record<string, number>; // session uuid -> TermStats.turnStartedAt, when known
  showAutomation: boolean;
}

// Every session becomes a kanban item EXCEPT one already represented by a
// card (its run IS the card — canvas-board.ts boundSessions) and automation
// noise (canvas-automation.ts), unless the user asked to see automations.
export function deriveSessionItems(o: DeriveSessionItemsOpts): SessionKanbanItem[] {
  const boundIds = new Set<string>();
  for (const c of o.cards) for (const sid of boundSessions(o.edges, c.id)) boundIds.add(sid);

  const out: SessionKanbanItem[] = [];
  for (const n of o.nodes) {
    if (n.kind !== 'session') continue;
    if (boundIds.has(n.ref)) continue;
    if (!o.showAutomation && isAutomationSession({ title: n.title, subtitle: n.subtitle })) continue;
    const running = o.running.has(n.ref);
    const waiting = !!n.waiting;
    const status = deriveSessionStatus({
      mtime: n.mtime, running, waiting, everRan: n.count !== 0,
      override: o.overrides[n.ref], turnStartedAt: o.turnStartedAt[n.ref],
    });
    out.push({
      nodeId: n.id, sessionId: n.ref, title: n.title, subtitle: n.subtitle,
      status, running, waitingOnUser: waiting, mtime: n.mtime,
    });
  }
  return out;
}

const DONE_RECENT_WINDOW_MS = 24 * 3600_000;

// Feeds the canvas "execução" scope (canvas-filter.ts): a session that just
// finished (Done) and hasn't been triaged into Completed within the last 24h
// still counts as something to look at; older than that, or already
// Completed, it drops off the default view same as any other stale node.
export function doneRecentSessionIds(items: SessionKanbanItem[], now: number): Set<string> {
  return new Set(
    items
      .filter((it) => it.status === 'review' && now - it.mtime < DONE_RECENT_WINDOW_MS)
      .map((it) => it.nodeId),
  );
}
