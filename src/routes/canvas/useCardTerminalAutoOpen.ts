import { useEffect } from 'react';
import { cardNodeId, sessionNodeId, type CanvasCard, type CanvasEdge, type CanvasPos } from '../../../shared/canvas';
import { hasPref, usePersisted } from '../../lib/persist';
import { capRecent, newlyBoundSessions } from './canvas-board';
import { TERM_H, winKey } from './canvas-terms';

const SEEN_KEY = 'canvas.seenCardSessions';

// A card's run becomes a real (marker-bound) session sometime after the turn
// starts — the moment that edge shows up in the graph, open its terminal so
// whoever is watching the card doesn't have to hunt for it.
//
// `seen` is persisted (capRecent'd) and seeded with whatever is ALREADY
// bound the FIRST time this ever runs on a device (`hasPref` distinguishes
// "never initialized" from "legitimately pruned to empty") — so a first load
// right after this feature deploys doesn't flood-open every doing card's
// entire retry history at once. Only a binding that shows up AFTER that
// baseline ever triggers an open.
//
// Goes through `autoOpen`/`autoAdd`, never `openWindow`/`capOpen`: the former
// only evicts a non-running window when over the open-terminal cap, the
// latter evicts blindly and would happily close a window the user is
// actively watching. Skips a saved winKey position — never overwrite a drag.
// `graphReady`: the server's canvas-graph frame (the ONLY source of real
// marker-bound session edges) answers well after canvas-board (a ~15-25s
// transcript rescan on the first load after a deploy — see server/canvas/
// index.ts). Before it lands, `edges` is empty regardless of what's actually
// bound, so seeding the baseline off an early, graph-less render would seed
// an EMPTY set — then the moment the real graph arrives, every historical
// binding it reveals looks "new" against that empty baseline and floods open
// at once. Nothing here runs at all until the caller reports the graph has
// actually loaded at least once.
export function useCardTerminalAutoOpen(
  cards: CanvasCard[],
  edges: CanvasEdge[],
  cardPos: Record<string, CanvasPos>,
  savedWinPos: Record<string, CanvasPos>,
  onCanvasPos: (pos: Record<string, CanvasPos>) => void,
  autoOpen: (ids: string[]) => void,
  graphReady: boolean,
) {
  const [seenCardSessions, setSeenCardSessions] = usePersisted<string[]>(SEEN_KEY, []);
  useEffect(() => {
    if (!graphReady) return;
    // Checked BEFORE the early "nothing fresh" exit below: a genuinely first
    // ever mount with NO bindings yet must still write the (empty) baseline,
    // so the NEXT render — the first REAL binding a fresh install ever sees
    // — isn't itself mistaken for "first load" and silently seeded instead
    // of opened.
    const firstLoad = !hasPref(SEEN_KEY);
    const seen = new Set(seenCardSessions);
    const fresh = newlyBoundSessions(cards, edges, seen);
    if (firstLoad) {
      setSeenCardSessions(capRecent([...seen]));
      return; // baseline seed only — nothing to open on it
    }
    if (!fresh.length) return;
    setSeenCardSessions(capRecent([...seen]));
    for (const { cardId, sessionId } of fresh) {
      const nodeId = sessionNodeId(sessionId);
      const posKey = winKey(nodeId);
      const spot = cardPos[cardNodeId(cardId)];
      if (!savedWinPos[posKey] && spot) onCanvasPos({ [posKey]: { x: spot.x, y: spot.y - TERM_H - 40 } });
      autoOpen([nodeId]);
    }
    // seenCardSessions/setSeenCardSessions deliberately excluded: reading the
    // just-written persisted value back would refire this effect on its own
    // write. `seen` is rebuilt from the current committed value every run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphReady, cards, edges, cardPos, savedWinPos, onCanvasPos, autoOpen]);
}
