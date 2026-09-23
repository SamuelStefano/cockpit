// Canvas of sessions × contexts: the wire shapes shared by server and client.
// A node id carries its kind as a prefix (s:, c:, k:) so positions, selection
// and edges address every node the same way.

export type CanvasNodeKind = 'session' | 'context' | 'card' | 'shell';

export type CardStatus = 'todo' | 'doing' | 'review' | 'done';
export const CARD_STATUSES: readonly CardStatus[] = ['todo', 'doing', 'review', 'done'];

export type ContentFormat = 'post' | 'thread' | 'changelog' | 'report' | 'reel' | 'daily';
export const CONTENT_FORMATS: readonly ContentFormat[] = ['post', 'thread', 'changelog', 'report', 'reel', 'daily'];

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
}

// 'card' = the agent actually ran on this session (marker-bound) or the card
// links this context; 'input' = the user picked this session as prompt input,
// which says nothing about who is running it or where "open session" should go.
export type CanvasEdgeKind = 'read' | 'write' | 'link' | 'card' | 'topic' | 'input';

export interface CanvasEdge {
  source: string;
  target: string;
  kind: CanvasEdgeKind;
  weight?: number; // 'topic' only: match strength, so the strongest guess can render bolder than a weak one
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
  mode?: 'plan' | 'auto' | 'acceptEdits';
  mcps?: string[];
}

export interface CanvasBoard {
  cards: CanvasCard[];
  pos: Record<string, CanvasPos>;
  flows: CanvasFlow[];
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
