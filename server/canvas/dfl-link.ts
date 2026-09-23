import type { CanvasGraph } from '../../shared/canvas';
import { cardNodeId } from '../../shared/canvas';
import type { DflDeliveryNode, DflPointsSnapshot, DflTaskNode } from '../../shared/protocol';

// Pure guards for the Kanban<->DFL card link (server/ws/dispatch.ts's
// dfl-task-link / dfl-task-create-link handlers). Nothing here touches the
// filesystem or the network — the caller feeds in a graph already built
// (buildCanvas) and a snapshot already loaded (readDflSnapshot), same as
// every other canvas write handler.

// STRICT, not the majority vote server/canvas/areas.ts uses for the card's
// display area (the colored region on the canvas map). A card linked to a
// MIX of DFL and personal contexts/sessions must never be linkable — a
// majority-DFL vote would let a card touching, say, 2 DFL sessions and 1
// pessoal one through, and whatever ends up in `description`/`context` on
// the DFL side is then reachable by anyone with DFL access. Every single
// linked context/session must classify 'dfl'; a card with nothing linked at
// all is NOT eligible either (fail closed, not "no evidence so sure why not").
export function cardLinksAreUnanimouslyDfl(graph: CanvasGraph, cardId: string): boolean {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const id = cardNodeId(cardId);
  const linked = graph.edges.filter((e) => e.source === id && (e.kind === 'card' || e.kind === 'input'));
  if (!linked.length) return false;
  return linked.every((e) => byId.get(e.target)?.area === 'dfl');
}

// dfl-task-link must only ever point a card at a task that ALREADY came out
// of the owner-filtered read channel (server/dfl-sync.ts's fetchDflBundle) —
// looking it up in the snapshot (rather than trusting the client's taskId
// outright) is what makes "opt-in link" impossible to point at someone
// else's task without a live PostgREST round-trip on every link click.
export function findTaskInSnapshot(snapshot: DflPointsSnapshot, taskId: string): DflTaskNode | undefined {
  for (const p of snapshot.projects) for (const e of p.epics) for (const d of e.deliveries) {
    const t = d.tasks.find((x) => x.id === taskId);
    if (t) return t;
  }
  return undefined;
}

// dfl-task-create-link's epicId/deliveryId are both client-supplied (picked
// from the same snapshot in the UI) — re-derived here as a PAIR, not each id
// checked in isolation, so a client can't mix a real deliveryId with an
// unrelated epicId and have the write land under the wrong epic.
export function findDeliveryInSnapshot(snapshot: DflPointsSnapshot, epicId: string, deliveryId: string): DflDeliveryNode | undefined {
  for (const p of snapshot.projects) for (const e of p.epics) {
    if (e.id !== epicId) continue;
    return e.deliveries.find((d) => d.id === deliveryId);
  }
  return undefined;
}
