import { isCronPing, type CanvasCard, type CanvasEdge, type CanvasNode, type TermStats } from '../../../shared/canvas';
import { ctxPct } from './term-stats-view';

// Ranks candidate sessions for a card's "continuar"/"fork" reuse (CardEditor):
// overlap between the card's contexts and what a session actually touched
// (graph edges read/write/topic, server/canvas/graph.ts), recency, and
// context headroom. Pure and tested without mounting the canvas route.

// Above this, a session is close enough to its window that reusing it (even
// via fork, which starts by reading the WHOLE transcript) risks a cold-start
// so big the turn dies at the cap — session-reuse.ts's whole point is to
// avoid a wasted re-read, not trade it for a worse one.
export const HEADROOM_LIMIT_PCT = 70;
// Below this, the session barely touched what the card is about — reusing it
// saves nothing over a clean session and just carries unrelated context along.
export const MIN_OVERLAP_PCT = 50;

export interface ReuseSuggestion {
  sessionId: string;
  title: string;
  // Continuing a RUNNING session would double-write its transcript (the same
  // guard #593's onSendTo/hasInteractiveClaude polices server-side) — a
  // running candidate only ever offers fork.
  running: boolean;
  overlapPct: number; // 0-100: share of the card's contexts this session touched
  ctxPctUsed: number | null; // headroom; null = no TermStats yet (unknown, not zero)
  ageMs: number;
  reason: string; // human pt-BR reason, e.g. "tocou 2 de 3 contextos · 34% de contexto · há 2h"
}

// Every context (read/write/topic edge, source=session) this session touched,
// by id — same three kinds server/canvas/graph.ts draws from a session to a
// context node.
export function contextsTouched(edges: CanvasEdge[], sessionId: string): Set<string> {
  const source = `s:${sessionId}`;
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source !== source || !e.target.startsWith('c:')) continue;
    if (e.kind === 'read' || e.kind === 'write' || e.kind === 'topic') out.add(e.target.slice(2));
  }
  return out;
}

export function overlapPct(cardContextIds: string[], touched: Set<string>): number {
  if (!cardContextIds.length) return 0;
  const hit = cardContextIds.filter((id) => touched.has(id)).length;
  return Math.round((hit / cardContextIds.length) * 100);
}

function formatAge(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `há ${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

export function buildReason(hitCount: number, cardTotal: number, ctxUsed: number | null, ageMs: number): string {
  const parts = [`tocou ${hitCount} de ${cardTotal} contexto${cardTotal === 1 ? '' : 's'}`];
  if (ctxUsed !== null) parts.push(`${ctxUsed}% de contexto`);
  parts.push(formatAge(ageMs));
  return parts.join(' · ');
}

export interface RankReuseInput {
  card: Pick<CanvasCard, 'contextIds'>;
  sessions: CanvasNode[]; // kind === 'session' nodes
  edges: CanvasEdge[];
  running: Set<string>;
  termStats: Record<string, TermStats>;
  now: number;
}

const TOP_N = 3;

// Sort: headroom-ok candidates first (never recommend into a near-full
// window), then by overlap (the actual relevance signal), then by recency.
// A session with ZERO overlap is only worth surfacing at all when it's
// currently running (offering fork on "what's live right now" is still
// useful even with no context match yet) — otherwise it's noise.
export function rankReuseCandidates(input: RankReuseInput): ReuseSuggestion[] {
  const { card, sessions, edges, running, termStats, now } = input;
  const cardTotal = card.contextIds.length;
  const out: ReuseSuggestion[] = [];
  for (const s of sessions) {
    if (isCronPing(s)) continue;
    const isRunning = running.has(s.ref);
    const touched = contextsTouched(edges, s.ref);
    const hit = card.contextIds.filter((id) => touched.has(id)).length;
    const overlap = cardTotal ? Math.round((hit / cardTotal) * 100) : 0;
    if (overlap === 0 && !isRunning) continue;
    const stats = termStats[s.ref];
    const pct = stats ? ctxPct(stats) : null;
    const ageMs = Math.max(0, now - s.mtime);
    out.push({
      sessionId: s.ref, title: s.title, running: isRunning, overlapPct: overlap, ctxPctUsed: pct, ageMs,
      reason: buildReason(hit, cardTotal || 1, pct, ageMs),
    });
  }
  return out
    .sort((a, b) => {
      const aOk = a.ctxPctUsed === null || a.ctxPctUsed < HEADROOM_LIMIT_PCT;
      const bOk = b.ctxPctUsed === null || b.ctxPctUsed < HEADROOM_LIMIT_PCT;
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (b.overlapPct !== a.overlapPct) return b.overlapPct - a.overlapPct;
      return a.ageMs - b.ageMs;
    })
    .slice(0, TOP_N);
}

export interface DefaultReuse { mode: 'new' | 'fork'; sessionId?: string }

// The safe default: fork never touches the parent, so it's the "efficient
// reuse" recommendation whenever the top candidate is actually relevant and
// has headroom — 'continue' is never the DEFAULT (only ever a deliberate
// pick in the UI), and a poor/no candidate falls back to a clean session.
export function defaultReuseMode(top: ReuseSuggestion | undefined): DefaultReuse {
  if (!top) return { mode: 'new' };
  const headroomOk = top.ctxPctUsed === null || top.ctxPctUsed < HEADROOM_LIMIT_PCT;
  if (top.overlapPct >= MIN_OVERLAP_PCT && headroomOk) return { mode: 'fork', sessionId: top.sessionId };
  return { mode: 'new' };
}

// The one-line tradeoff hint CardEditor always shows next to the reuse picker.
export const REUSE_TRADEOFF_HINT = 'reusar economiza re-leitura; sessão limpa evita contexto poluído';
