// Canvas of sessions × contexts: the wire shapes shared by server and client.
// A node id carries its kind as a prefix (s:, c:, k:) so positions, selection
// and edges address every node the same way.

export type CanvasNodeKind = 'session' | 'context' | 'card' | 'shell';

// Work-front grouping, derived from the memory graph (server/canvas/areas.ts)
// and rendered as a colored region on the canvas. Capped at 6 so the map
// never grows a 7th color nobody can tell apart from the other 6 at a glance.
export type AreaId = 'dfl' | 'itera' | 'deck' | 'pessoal' | 'infra' | 'outros';
export const AREA_IDS: readonly AreaId[] = ['dfl', 'itera', 'deck', 'pessoal', 'infra', 'outros'];
export const AREA_LABELS: Record<AreaId, string> = {
  dfl: 'DFL', itera: 'Itera', deck: 'Deck', pessoal: 'Pessoal', infra: 'Infra', outros: 'Outros',
};

export type CardStatus = 'todo' | 'doing' | 'review' | 'done';
export const CARD_STATUSES: readonly CardStatus[] = ['todo', 'doing', 'review', 'done'];

export type ContentFormat = 'post' | 'thread' | 'changelog' | 'report' | 'reel' | 'daily';
export const CONTENT_FORMATS: readonly ContentFormat[] = ['post', 'thread', 'changelog', 'report', 'reel', 'daily'];

// How runCard launches this card's agent: a fresh session seeded with its
// contexts/sessions (the default, `undefined` reads the same as 'new'), the
// prompt sent into an ALREADY-running session (`continue`, its own turn — no
// re-seeding, the session already has that context), or a NEW session forked
// from one (`fork`, `--fork-session`: inherits the parent's whole transcript,
// leaves the parent untouched). `sessionId` is required for continue/fork.
export interface CardReuse {
  mode: 'new' | 'continue' | 'fork';
  sessionId?: string;
}

export interface CanvasCard {
  id: string;
  title: string;
  prompt: string;
  status: CardStatus;
  kind: 'task' | 'content';
  format?: ContentFormat;
  contextIds: string[];
  sessionIds: string[];
  createdAt: number;
  updatedAt: number;
  reuse?: CardReuse;
}

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  ref: string; // session uuid, context slug or card id
  title: string;
  subtitle: string;
  mtime: number;
  archived?: boolean; // session hidden from the sidebar, or context from the memory archive
  hub?: boolean;
  status?: CardStatus;
  path?: string; // absolute file of a context, so a prompt can point the agent at it
  count?: number; // session only: user+assistant turns, for the cron-ping/empty check
  waiting?: boolean; // session only: turn stopped on a pending AskUserQuestion
  area?: AreaId; // set by server/canvas/areas.ts; absent = no hub/leaf evidence (client-only shell nodes stay unset too)
  // Session only: merged transcript-activity windows (ms epoch), newest last,
  // capped server-side. Feeds the timeline's aliveAt(node, t) — a session is
  // "alive" around any timestamp that falls in (or near) one of these.
  activity?: [number, number][];
}

// 'card' = the agent actually ran on this session (marker-bound) or the card
// links this context; 'input' = the user picked this session as prompt input,
// which says nothing about who is running it or where "open session" should go.
// 'conflict' = two sessions wrote the same file (outside memory) close in time.
export type CanvasEdgeKind = 'read' | 'write' | 'link' | 'card' | 'topic' | 'input' | 'conflict';

export interface CanvasEdge {
  source: string;
  target: string;
  kind: CanvasEdgeKind;
  weight?: number; // 'topic' only: match strength, so the strongest guess can render bolder than a weak one
  files?: string[]; // 'conflict' only: absolute paths both sessions wrote, newest first, capped
}

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  builtAt: number;
}

export interface CanvasPos { x: number; y: number }

// A drawn pipeline: when the turn on `from` closes, its result becomes the
// prompt of `to`. Both ends are `s:<session uuid>` or `k:<card id>` — the only
// two kinds server/canvas/flows.ts knows how to deliver a prompt to.
//
// mode/mcps are explicit, least-privilege OPT-INS for the target turn — the
// source turn's own `bypass`/`mcps` never propagate (the source's text is
// model output, steerable by whatever it read, so blindly inheriting a
// bypass-permissions turn or a broad MCP set would be a prompt-injection
// pivot). Unset means the target runs with no MCPs and its own default mode.
export interface CanvasFlow {
  id: string;
  from: string;
  to: string;
  template: string;
  enabled: boolean;
  createdAt: number;
  lastFiredAt?: number;
  fires: number;
  // Consecutive FAILED deliveries (server-owned, like fires/lastFiredAt — see
  // server/canvas/board.ts sanitizeFlow). Backs the exponential backoff in
  // server/canvas/flows.ts: a flow that keeps failing (target gone,
  // concurrency cap, ...) waits longer between retries instead of hammering
  // every source turn close. Reset to 0 on the next successful delivery.
  failStreak?: number;
  lastFailedAt?: number;
  // Set alongside failStreak/lastFailedAt when the LAST failure was the
  // target's area sitting over budget (server/canvas/flows.ts's
  // isAreaAdmissionBlocked gate) — backoffMs uses a much shorter cap for this
  // case (the area is expected to recover in minutes, not the ~30min ceiling
  // a genuinely broken target deserves). Cleared on the next success, same as
  // failStreak.
  lastFailAreaBlocked?: boolean;
  mode?: 'plan' | 'auto' | 'acceptEdits';
  mcps?: string[];
}

// A ceiling on one area's live usage. Both fields optional (set only the one
// you want enforced); autoPause is opt-in and off unless explicitly turned on.
export interface AreaBudget {
  ctxTokens?: number; // sum of contextTokens across the area's RUNNING sessions
  cpu?: number;       // sum of cpu% across the area's RUNNING sessions (claude tree + tmux pane)
  autoPause?: boolean;
}

// A user override on a session's derived kanban status (src/routes/canvas/
// kanban-items.ts owns the derivation and the expiry rule: a turn on the
// session that starts/closes AFTER `at` makes the override stale and the
// automatic reading takes back over — see isOverrideActive there). Keyed by
// session uuid, never by node id.
export interface CanvasSessionStatus { status: CardStatus; at: number }

export interface CanvasBoard {
  cards: CanvasCard[];
  pos: Record<string, CanvasPos>;
  flows: CanvasFlow[];
  budgets: Partial<Record<AreaId, AreaBudget>>;
  sessionStatus: Record<string, CanvasSessionStatus>;
}

// A card-target flow's in-flight run — server/canvas/flow-runs.ts, transient
// (process memory only, never persisted to the board file). Sent alongside
// canvas-board so a tab that (re)connects mid-run — F5, a second tab, a
// browser opened after the flow already fired — learns the card is running
// without having missed the one-shot `canvas-flow-run` broadcast.
export interface CanvasFlowRun {
  runKey: string;
  cardId: string;
  flowId: string;
}

export const FLOW_ID_RE = /^[a-z0-9-]{4,40}$/;
// Only a session or a card can sit at either end of a flow — never a context
// or a shell, which server/canvas/flows.ts has no way to deliver a prompt to.
export const isFlowEndpoint = (id: string): boolean => /^[sk]:[A-Za-z0-9_-]{1,80}$/.test(id);

export const DEFAULT_FLOW_TEMPLATE = 'Continue a partir do resultado da etapa anterior:\n\n{{result}}';

// Every prompt the orchestrator sends carries this, so the next close knows how
// deep the chain already is (server/canvas/flows.ts caps it at MAX_HOPS).
export const flowMarker = (id: string, hop: number) => `[deck-flow:${id}:${hop}]`;
export const FLOW_MARKER_RE = /\[deck-flow:([a-z0-9-]{4,40}):(\d+)\]/;

export const sessionNodeId = (id: string) => `s:${id}`;
export const contextNodeId = (id: string) => `c:${id}`;
export const cardNodeId = (id: string) => `k:${id}`;
// tmux names are capped at 32 chars by the server allow-list, so the uuid is
// folded to its first 24 hex digits — plenty to stay unique across sessions.
export const watchTermId = (sessionId: string) => 'w-' + sessionId.replace(/-/g, '').slice(0, 24);

// Live numbers behind a canvas terminal window, keyed by session uuid or termId.
export interface TermStats {
  cpu: number; // % of one core since the previous poll
  rssMb: number;
  procs: number;
  contextTokens?: number;
  model?: string;
  lastAt?: number; // newest transcript record
  turnStartedAt?: number; // set while the Deck runs a turn on it
}

// Client-only: tmux shells placed on the canvas (the server graph never emits them).
export const shellNodeId = (termId: string) => `t:${termId}`;

export const CARD_ID_RE = /^[a-z0-9-]{4,40}$/;
// A launched prompt ends with this marker; the transcript scanner reads it back
// from the first user message and binds the session to its card, which survives
// the new-xxx → sessionId migration without any client bookkeeping.
export const cardMarker = (id: string) => `[deck-card:${id}]`;
export const CARD_MARKER_RE = /\[deck-card:([a-z0-9-]{4,40})\]/;

// Cron-reset ping sessions: daily crons that send only a "." (sometimes with
// "não responder") just to reset the account's rate-limit window. Noise in the
// sidebar and on the canvas alike — the user never wants them as conversations.
// Matches the EXACT ping text (title/snippet derived from the 1st message),
// not "starts with a dot", so it never swallows a real short message. New reset
// prompt variants join this set. Lives here (not src/cockpit/session.ts, the
// original home) because it is also needed by the canvas filter, which is pure
// TS tested under Node — session.ts pulls in `location` at import time and
// breaks outside a browser/jsdom environment.
const PING_TEXTS = new Set([
  '.', '. - nao responder', '. - não responder', '.- nao responder', '.- não responder',
  // Bare variant (no leading "." at all), confirmed against real recent titles
  // while building the canvas topic matcher: "Nao responder" / "Não responder"
  // alone, same reset cron, just without the dot.
  'nao responder', 'não responder',
]);
export function isCronPing(m: { title?: string; snippet?: string }): boolean {
  const t = (m.snippet || m.title || '').trim().toLowerCase();
  return PING_TEXTS.has(t);
}
