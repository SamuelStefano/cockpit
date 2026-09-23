import { deliveryTasks, type DflDraft } from '../../../shared/dfl-drafts';
import type { DispatchUnit } from '../../../shared/dfl-drafts-note';
import { pendingIds } from './draft-cap';

// What each "criar no DFL" button hands the agent. Only tasks still pending go:
// anything already sent is never sent twice. null = nothing left to send.

export function epicUnit(d: DflDraft): DispatchUnit | null {
  const pend = pendingIds(d);
  if (!pend.length) return null;
  return pend.length === d.tasks.length ? { draft: d } : { draft: d, taskIds: pend };
}

export function deliveryUnit(d: DflDraft, deliveryId: string): DispatchUnit | null {
  const ids = deliveryTasks(d, deliveryId).filter((t) => t.status === 'draft').map((t) => t.id);
  return ids.length ? { draft: d, taskIds: ids } : null;
}

export function selectionUnit(d: DflDraft, selected: ReadonlySet<string>): DispatchUnit | null {
  const ids = pendingIds(d).filter((id) => selected.has(id));
  return ids.length ? { draft: d, taskIds: ids } : null;
}
