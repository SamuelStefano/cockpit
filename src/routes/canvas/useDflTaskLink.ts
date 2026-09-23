import { useMemo, useState } from 'react';
import type { CanvasCard } from '../../../shared/canvas';
import type { DflPointsSnapshot } from '../../../shared/protocol';
import type { DflWriteResult } from '../../cockpit/usePoints';

export interface DflTaskOption { id: string; name: string; deliveryName: string; epicName: string; projectName: string }
export interface DflDeliveryOption { epicId: string; deliveryId: string; label: string }

// Flattens the project›epic›delivery›task tree (same snapshot /pontos already
// fetches — server/dfl-sync.ts's fetchDflBundle, owner-filtered at the
// source) into the two flat lists the link picker searches over.
export function flattenDflTasks(snapshot: DflPointsSnapshot | null): DflTaskOption[] {
  if (!snapshot) return [];
  const out: DflTaskOption[] = [];
  for (const p of snapshot.projects) for (const e of p.epics) for (const d of e.deliveries) for (const t of d.tasks) {
    out.push({ id: t.id, name: t.name, deliveryName: d.name, epicName: e.name, projectName: p.name });
  }
  return out;
}
export function flattenDflDeliveries(snapshot: DflPointsSnapshot | null): DflDeliveryOption[] {
  if (!snapshot) return [];
  const out: DflDeliveryOption[] = [];
  for (const p of snapshot.projects) for (const e of p.epics) for (const d of e.deliveries) {
    out.push({ epicId: e.id, deliveryId: d.id, label: `${p.name} / ${e.name} / ${d.name}` });
  }
  return out;
}

interface Args {
  card: CanvasCard;
  snapshot: DflPointsSnapshot | null;
  onLink: (cardId: string, taskId: string) => Promise<DflWriteResult>;
  onCreateLink: (cardId: string, taskName: string, epicId: string, deliveryId: string, why: string, what: string) => Promise<DflWriteResult>;
  onUnlink: (cardId: string) => boolean;
}

// A pending action awaiting the explicit confirm step — holds EXACTLY what
// will be sent to DFL, so the review screen renders the real payload, never
// a guess at it. Never includes the card's `prompt`: why/what are typed
// fresh by the user (see DflLinkSection), the card's agent instructions have
// no business reaching a DFL-visible task.
type PendingAction =
  | { kind: 'link'; taskId: string; taskName: string }
  | { kind: 'create'; taskName: string; epicId: string; deliveryId: string; deliveryLabel: string; why: string; what: string };

// UI-independent state for CardEditor's DFL link section: search text, the
// "create new" delivery pick, the two-step confirm flow, in-flight/error
// state for the link/create calls. Kept out of the component so
// DflLinkSection.tsx stays render-only.
export function useDflTaskLink({ card, snapshot, onLink, onCreateLink, onUnlink }: Args) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'existing' | 'create'>('existing');
  const [deliveryPick, setDeliveryPick] = useState('');
  const [newTaskName, setNewTaskName] = useState(card.title);
  const [why, setWhy] = useState('');
  const [what, setWhat] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const tasks = useMemo(() => flattenDflTasks(snapshot), [snapshot]);
  const deliveries = useMemo(() => flattenDflDeliveries(snapshot), [snapshot]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks.slice(0, 8);
    return tasks.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 8);
  }, [tasks, query]);

  // Step 1: pick a target — just arms the review screen, no network yet.
  const review = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    setError(undefined);
    setPending({ kind: 'link', taskId, taskName: t?.name ?? taskId });
  };
  const reviewCreate = () => {
    const [epicId, deliveryId] = deliveryPick.split('|');
    const d = deliveries.find((x) => x.epicId === epicId && x.deliveryId === deliveryId);
    if (!epicId || !deliveryId || !d || !newTaskName.trim() || !why.trim() || !what.trim()) return;
    setError(undefined);
    setPending({ kind: 'create', taskName: newTaskName.trim(), epicId, deliveryId, deliveryLabel: d.label, why: why.trim(), what: what.trim() });
  };
  const cancelReview = () => setPending(null);

  // Step 2: explicit confirm — the only place either write actually fires.
  const confirm = async () => {
    if (!pending) return;
    setBusy(true); setError(undefined);
    const r = pending.kind === 'link'
      ? await onLink(card.id, pending.taskId)
      : await onCreateLink(card.id, pending.taskName, pending.epicId, pending.deliveryId, pending.why, pending.what);
    setBusy(false);
    if (!r.ok) { setError(r.message ?? 'falha ao vincular'); return; }
    setPending(null);
  };

  const unlink = () => onUnlink(card.id);

  return {
    query, setQuery, mode, setMode, deliveryPick, setDeliveryPick, newTaskName, setNewTaskName,
    why, setWhy, what, setWhat, pending, busy, error, filtered, deliveries,
    review, reviewCreate, cancelReview, confirm, unlink,
  };
}
