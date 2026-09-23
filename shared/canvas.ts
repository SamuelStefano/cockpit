// Canvas of sessions × contexts: the wire shapes shared by server and client.
// A node id carries its kind as a prefix (s:, c:, k:) so positions, selection
// and edges address every node the same way.

export type CanvasNodeKind = 'session' | 'context' | 'card';

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
}

export type CanvasEdgeKind = 'read' | 'write' | 'link' | 'card';

export interface CanvasEdge {
  source: string;
  target: string;
  kind: CanvasEdgeKind;
}

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  builtAt: number;
}

export interface CanvasPos { x: number; y: number }

export interface CanvasBoard {
  cards: CanvasCard[];
  pos: Record<string, CanvasPos>;
}

export const sessionNodeId = (id: string) => `s:${id}`;
export const contextNodeId = (id: string) => `c:${id}`;
export const cardNodeId = (id: string) => `k:${id}`;

export const CARD_ID_RE = /^[a-z0-9-]{4,40}$/;
// A launched prompt ends with this marker; the transcript scanner reads it back
// from the first user message and binds the session to its card, which survives
// the new-xxx → sessionId migration without any client bookkeeping.
export const cardMarker = (id: string) => `[deck-card:${id}]`;
export const CARD_MARKER_RE = /\[deck-card:([a-z0-9-]{4,40})\]/;
