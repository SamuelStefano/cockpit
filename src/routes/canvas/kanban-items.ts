import type { AreaId, CanvasCard, CanvasEdge, CanvasNode, CardStatus } from '../../../shared/canvas';
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
  // The last turn that closed did NOT end cleanly (crashed/stopped/failed —
  // server/ws/runs.ts isCleanTurnClose said no) — a session in this state
  // never reads as Done: nobody asked the agent to stop, so nothing was
  // actually delivered. See needsAttention below for the accompanying badge.
  attentionNeeded?: boolean;
  override?: SessionStatusOverride;
  turnStartedAt?: number;
}

// running/waiting are read off LIVE state (phases, SessionMeta.waiting) and
// checked BEFORE the override: either one being true means a turn is
// happening right now, which is always "a new turn after the override" even
// when it hasn't finished long enough to move `mtime` past `override.at` yet
// (the transcript write lands at turn close, not at turn start). Once neither
// is true, isOverrideActive is the real expiry check. What's left after that
// is the automatic reading: never ran a turn -> ToDo (rare); a bad last close
// -> In progress (attentionNeeded, never silently Done); otherwise the agent
// closed a turn cleanly and nobody has looked -> Done.
export function deriveSessionStatus(i: DeriveSessionStatusInput): CardStatus {
  if (i.running) return 'doing';
  if (i.waiting) return 'doing';
  if (isOverrideActive(i.override, i.mtime, i.turnStartedAt)) return i.override!.status;
  if (!i.everRan) return 'todo';
  if (i.attentionNeeded) return 'doing';
  return 'review';
}

// A session deckctl (or the orchestrator itself) launched AS a delegated
// worker names itself in its very first message — buildTaskPrompt-style
// briefs open with this line, and a hand-rolled one can opt in with the
// short `[orch]` marker. That first message is exactly what `subtitle`
// already carries (server/sessions/index.ts snippet, 120 chars of the first
// user message), so no server plumbing is needed for THIS source — see
// canvas-automation.ts for the same trick applied to automation noise.
// tmux-shell-sourced children (a `cockpit-cv-*` orchestrator opened directly,
// tracked by ~/.cockpit/orch-shells/<name>.{prompt,report}.md) are a SEPARATE
// source this text match can't see — server/canvas doesn't surface those
// files into the graph yet, so a shell child only shows up here once that
// plumbing exists.
const ORCH_CHILD_MARKER_RE = /^you are a delegated worker of the orchestrator\b|\[orch\]/i;
export function isOrchestratorChildText(subtitle: string): boolean {
  return ORCH_CHILD_MARKER_RE.test(subtitle);
}

export interface SessionKanbanItem {
  nodeId: string; // 's:<uuid>'
  sessionId: string;
  title: string;
  subtitle: string;
  // server/canvas/areas.ts work-front grouping — undefined for a session with
  // no memory trail yet (areas.ts hasn't classified it). Samuel asked the
  // kanban to say WHERE a session belongs, not just what it's doing.
  area?: AreaId;
  // A worker the Orchestrator delegated to (isOrchestratorChildText) — while
  // alive (running/waiting/doing) it groups into its own fuchsia swimlane
  // inside "In progress" instead of blending into Samuel's own sessions.
  orchestratorChild: boolean;
  status: CardStatus;
  running: boolean;
  waitingOnUser: boolean;
  // Last turn crashed/stopped/failed and nothing has happened since (not
  // running, not waiting, not overridden) — badge only, status is 'doing'.
  needsAttention: boolean;
  mtime: number;
}

// The freshest read of a session's live fields, preferred over the (possibly
// one-rebuild-stale) CanvasNode — src/data/types.ts Session, keyed by id.
// `lastTurnOk` comes from server/sessions/turn-outcome.ts via SessionMeta;
// undefined means "never closed a turn in this server process", not a crash.
export interface LiveSessionInfo { waiting?: boolean; mtime: number; lastTurnOk?: boolean }

interface NodeStatusOpts {
  running: Set<string>;
  overrides: Record<string, SessionStatusOverride>;
  turnStartedAt: Record<string, number>;
  liveSessions?: Map<string, LiveSessionInfo>;
  // sessionKey -> endReason for a RECOVERABLE cut (budget/max_turns) the
  // CURRENT client just watched happen — src/useCockpit.ts `interrupted`.
  // Arrives before a resync would ever pick up the server-persisted
  // lastTurnOk, so it's checked independently, not as a fallback.
  interrupted?: Record<string, string>;
}

interface NodeStatus { status: CardStatus; running: boolean; waiting: boolean; needsAttention: boolean; mtime: number }

function nodeStatus(n: CanvasNode, o: NodeStatusOpts): NodeStatus {
  const live = o.liveSessions?.get(n.ref);
  const running = o.running.has(n.ref);
  const waiting = live?.waiting ?? !!n.waiting;
  const mtime = live?.mtime ?? n.mtime;
  const lastTurnOk = live?.lastTurnOk;
  const attentionNeeded = lastTurnOk === false || !!o.interrupted?.[n.ref];
  const override = o.overrides[n.ref];
  const turnStartedAt = o.turnStartedAt[n.ref];
  const status = deriveSessionStatus({ mtime, running, waiting, everRan: n.count !== 0, attentionNeeded, override, turnStartedAt });
  const needsAttention = attentionNeeded && !running && !waiting && !isOverrideActive(override, mtime, turnStartedAt);
  return { status, running, waiting, needsAttention, mtime };
}

export interface DeriveSessionItemsOpts extends NodeStatusOpts {
  nodes: CanvasNode[]; // merged.nodes (session + card nodes at least)
  edges: CanvasEdge[]; // merged.edges
  cards: CanvasCard[];
  showAutomation: boolean;
  // Card->session bindings the caller can see but the graph doesn't know
  // about YET (src/routes/canvas/useCanvasRoute.ts pendingLaunch + the
  // server-fired canvasFlowRuns) — a card whose agent just launched or whose
  // flow just fired shows the session as running "on the card" well before
  // refs.ts's transcript scan records the real [deck-card:] marker edge.
  // Without this, that same session doubles as its own standalone item until
  // the graph catches up.
  extraBoundIds?: Iterable<string>;
  // The orchestrator's session (shared/canvas.ts OrchestratorInfo.sessionId,
  // when one is configured) never becomes a normal ToDo/Doing/Review/Done
  // item — Kanban.tsx pins it above the columns instead, via
  // orchestratorKanbanItem below.
  orchestratorSessionId?: string;
}

// Every session becomes a kanban item EXCEPT one already represented by a
// card (its run IS the card — canvas-board.ts boundSessions, plus whatever
// extraBoundIds the caller adds), the orchestrator's own session, and
// automation noise (canvas-automation.ts), unless the user asked to see
// automations.
export function deriveSessionItems(o: DeriveSessionItemsOpts): SessionKanbanItem[] {
  const boundIds = new Set<string>();
  for (const c of o.cards) for (const sid of boundSessions(o.edges, c.id)) boundIds.add(sid);
  if (o.extraBoundIds) for (const sid of o.extraBoundIds) boundIds.add(sid);

  const out: SessionKanbanItem[] = [];
  for (const n of o.nodes) {
    if (n.kind !== 'session') continue;
    if (n.ref === o.orchestratorSessionId) continue;
    if (boundIds.has(n.ref)) continue;
    if (!o.showAutomation && isAutomationSession({ title: n.title, subtitle: n.subtitle })) continue;
    const ns = nodeStatus(n, o);
    out.push({
      nodeId: n.id, sessionId: n.ref, title: n.title, subtitle: n.subtitle, area: n.area, orchestratorChild: isOrchestratorChildText(n.subtitle),
      status: ns.status, running: ns.running, waitingOnUser: ns.waiting, needsAttention: ns.needsAttention, mtime: ns.mtime,
    });
  }
  return out;
}

// The item pinned above the kanban columns (Kanban.tsx) — same shape as any
// other row, computed the same way, just never filtered by automation/bound
// status: the orchestrator always shows, however it's wired up.
export function orchestratorKanbanItem(nodes: CanvasNode[], o: NodeStatusOpts, orchestratorSessionId: string | undefined): SessionKanbanItem | undefined {
  if (!orchestratorSessionId) return undefined;
  const n = nodes.find((x) => x.kind === 'session' && x.ref === orchestratorSessionId);
  if (!n) return undefined;
  const ns = nodeStatus(n, o);
  return {
    nodeId: n.id, sessionId: n.ref, title: n.title, subtitle: n.subtitle, area: n.area, orchestratorChild: isOrchestratorChildText(n.subtitle),
    status: ns.status, running: ns.running, waitingOnUser: ns.waiting, needsAttention: ns.needsAttention, mtime: ns.mtime,
  };
}

// A card launched via runCard (or a #592 flow run) is bound under its
// `new-<uuid>` local run key, which never equals a real session node's `ref`
// — deriveSessionItems' dedup above only matches `ref`, so between launch and
// refs.ts's transcript scan recording the [deck-card:] marker edge, the
// session showed BOTH as the card (doing) and as its own standalone kanban
// item. useCockpit's migrateKey resolves a `new-` key to the real session id
// the moment the turn ends locally (well before a graph rebuild), so folding
// that resolved id in here closes the gap without waiting on the graph.
export function resolvePendingBoundIds(pendingKeys: Iterable<string>, pendingSessionIds: Record<string, string>): Set<string> {
  const out = new Set<string>();
  for (const key of pendingKeys) {
    out.add(key);
    const real = pendingSessionIds[key];
    if (real) out.add(real);
  }
  return out;
}

// Kanban triage (Samuel feedback, 2026-09-24): sessionItems is unscoped by
// design (every session ever, not just what canvas-filter.ts shows) — which
// means "Done" fills with hundreds of sessions nobody is ever going to
// review. Split what actually needs a look from what's just old.
export const KANBAN_STALE_MS = 24 * 3600_000;

export interface KanbanTriage {
  visible: SessionKanbanItem[]; // shown in their normal column, unchanged
  // Agent-said-Done (status 'review') and idle for a day: still real work,
  // just not urgent — collapsed under "antigos" at the bottom of Done rather
  // than auto-flipped to Completed (that status change is Samuel's call, not
  // a UI default's).
  staleDone: SessionKanbanItem[];
  // Any OTHER column, idle for a day, with nothing pending (not running, not
  // waiting on Samuel, no attention badge): off the board entirely. Exposed
  // as a count, not a list — there's nothing actionable left to show.
  hiddenIdle: SessionKanbanItem[];
}

export function triageSessionItems(items: SessionKanbanItem[], now: number): KanbanTriage {
  const visible: SessionKanbanItem[] = [];
  const staleDone: SessionKanbanItem[] = [];
  const hiddenIdle: SessionKanbanItem[] = [];
  for (const item of items) {
    const noPendingQuestion = !item.running && !item.waitingOnUser && !item.needsAttention;
    const stale = noPendingQuestion && now - item.mtime > KANBAN_STALE_MS;
    if (!stale) visible.push(item);
    else if (item.status === 'review') staleDone.push(item);
    else hiddenIdle.push(item);
  }
  return { visible, staleDone, hiddenIdle };
}

const DONE_RECENT_WINDOW_MS = 24 * 3600_000;

// Feeds the canvas "execução" scope (canvas-filter.ts): a session that just
// finished (Done) and hasn't been triaged into Completed within the last 24h
// still counts as something to look at; older than that, or already
// Completed, it drops off the default view same as any other stale node.
// Runs over EVERY session node, not the (deduped, automation-filtered)
// output of deriveSessionItems — a session bound to a card is still worth
// framing the moment it finishes, whether or not the card itself is done.
export function doneRecentSessionIds(nodes: CanvasNode[], o: NodeStatusOpts, now: number): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== 'session') continue;
    const ns = nodeStatus(n, o);
    if (ns.status === 'review' && now - ns.mtime < DONE_RECENT_WINDOW_MS) out.add(n.id);
  }
  return out;
}
