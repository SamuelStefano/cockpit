import type { AreaId, CanvasGraph } from '../../shared/canvas';
import { cardNodeId } from '../../shared/canvas';
import type { DflDeliveryNode, DflPointsSnapshot, DflTaskNode } from '../../shared/protocol';

// Pure guards for the Kanban<->DFL card link (server/ws/dispatch.ts's
// dfl-task-link / dfl-task-create-link handlers). Nothing here touches the
// filesystem or the network — the caller feeds in a graph already built
// (buildCanvas) and a snapshot already loaded (readDflSnapshot), same as
// every other canvas write handler.

// A card's area is whatever server/canvas/areas.ts derived for its `k:<id>`
// node THIS build — never read off the client, never cached across calls.
// Absent (no linked context/session yet classified) reads as "not dfl".
export function cardAreaFromGraph(graph: CanvasGraph, cardId: string): AreaId | undefined {
  return graph.nodes.find((n) => n.id === cardNodeId(cardId))?.area;
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
