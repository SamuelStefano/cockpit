import { useEffect, useMemo, useRef } from 'react';
import type { CanvasCard, CanvasEdge, CanvasNode, TermStats } from '../../../shared/canvas';
import { defaultReuseMode, rankReuseCandidates, type ReuseSuggestion } from './session-reuse';

interface Params {
  isNew: boolean;
  card: CanvasCard;
  patch: (p: Partial<CanvasCard>) => void;
  sessions: CanvasNode[];
  edges: CanvasEdge[];
  running: Set<string>;
  termStats: Record<string, TermStats>;
  // 'canvas-ctx-stats' — a SEPARATE, lighter request than the window
  // poller's 'canvas-term-stats' (shared/protocol.ts has the why): reads
  // only the transcript tail, never touches the per-socket CPU sample store
  // or joins running-session ids into an area-usage computation (review
  // #597 follow-up point 2 — mixing the two flashed window CPU% to 0 and
  // flipped the ranking every 3s).
  onCtxStats: (sessions: string[]) => void;
}

// CardEditor's reuse picker: ranking, the one-shot fetch of REAL context usage
// for the ranked pool, and the safe-default application. Split out of the
// component so CardEditor stays JSX-only (repo convention).
export function useCardReuse({ isNew, card, patch, sessions, edges, running, termStats, onCtxStats }: Params) {
  const candidates = useMemo(
    () => rankReuseCandidates({ card, sessions, edges, running, termStats, now: Date.now() }),
    [card.contextIds, sessions, edges, running, termStats],
  );

  // Real ctx usage for exactly the ranked pool: most candidates never had an
  // open canvas terminal, so `termStats` is otherwise empty for them — the
  // server answers from the transcript TAIL alone (server/canvas/term-stats.ts
  // collectCtxOnly/lastUsage), no open pane required. Keyed on the id LIST
  // (not the array reference, which churns every render) so this fires once
  // per actual pool change, not once per parent re-render.
  const poolKey = candidates.map((c) => c.sessionId).join(',');
  useEffect(() => {
    if (poolKey) onCtxStats(poolKey.split(','));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poolKey encodes the id list; onCtxStats is a stable useCallback (useCanvas.ts)
  }, [poolKey]);

  // The safe default (session-reuse.ts) applies ONCE, only for a brand-new
  // card the user hasn't touched, and only once headroom is actually KNOWN —
  // an unfetched ctxPctUsed (null) must never read as "ok" (review #597 point
  // 2), so this waits for the onCtxStats round-trip above instead of
  // deciding synchronously at mount (a lazy useState init never gets that
  // chance: the real number always arrives later).
  const defaulted = useRef(false);
  useEffect(() => {
    if (!isNew || defaulted.current || card.reuse) return;
    const top = candidates[0];
    if (top && top.ctxPctUsed === null) return; // real number not in yet — wait for the next candidates recompute
    defaulted.current = true;
    const def = defaultReuseMode(top);
    if (def.mode !== 'new') patch({ reuse: { mode: def.mode, sessionId: def.sessionId } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- card.reuse/patch read via closure on purpose: re-running on their OWN change would fight a pick the user just made
  }, [candidates]);

  // A running candidate can never be "continued" (double-writer guard, same
  // as onSendTo hits server-side) — picking one always means fork, whichever
  // button was clicked.
  const pickReuse = (mode: 'continue' | 'fork', c: ReuseSuggestion) =>
    patch({ reuse: { mode: mode === 'continue' && c.running ? 'fork' : mode, sessionId: c.sessionId } });

  return { candidates, pickReuse };
}
