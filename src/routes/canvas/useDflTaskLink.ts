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
  onCreateLink: (cardId: string, taskName: string, epicId: string, deliveryId: string) => Promise<DflWriteResult>;
  onUnlink: (cardId: string) => boolean;
}

// UI-independent state for CardEditor's DFL link section: search text, the
// "create new" delivery pick, in-flight/error state for the link/create
// calls. Kept out of the component so DflLinkSection.tsx stays render-only.
export function useDflTaskLink({ card, snapshot, onLink, onCreateLink, onUnlink }: Args) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'existing' | 'create'>('existing');
  const [deliveryPick, setDeliveryPick] = useState('');
  const [newTaskName, setNewTaskName] = useState(card.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const tasks = useMemo(() => flattenDflTasks(snapshot), [snapshot]);
  const deliveries = useMemo(() => flattenDflDeliveries(snapshot), [snapshot]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks.slice(0, 8);
    return tasks.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 8);
  }, [tasks, query]);

  const link = async (taskId: string) => {
    setBusy(true); setError(undefined);
    const r = await onLink(card.id, taskId);
    setBusy(false);
    if (!r.ok) setError(r.message ?? 'falha ao vincular');
  };

  const createAndLink = async () => {
    const [epicId, deliveryId] = deliveryPick.split('|');
    if (!epicId || !deliveryId || !newTaskName.trim()) return;
    setBusy(true); setError(undefined);
    const r = await onCreateLink(card.id, newTaskName.trim(), epicId, deliveryId);
    setBusy(false);
    if (!r.ok) setError(r.message ?? 'falha ao criar task');
  };

  const unlink = () => onUnlink(card.id);

  return { query, setQuery, mode, setMode, deliveryPick, setDeliveryPick, newTaskName, setNewTaskName, busy, error, filtered, deliveries, link, createAndLink, unlink };
}
