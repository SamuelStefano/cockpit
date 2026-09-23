import { useEffect, useRef, useState } from 'react';
import { draftPoints, type DflDraft, type DraftOp } from '../../../shared/dfl-drafts';
import type { DispatchUnit } from '../../../shared/dfl-drafts-note';
import { centsFromPoints } from './money';
import { draftCap, draftProgress, suggestSplit } from './draft-cap';
import { deliveryUnit, epicUnit, selectionUnit } from './dispatch-units';

export type AskDispatch = (title: string, units: (DispatchUnit | null)[]) => void;

interface Args {
  draft: DflDraft;
  pointValue: number;
  op: (o: DraftOp) => void;
  ask: AskDispatch;
}

// Everything the draft detail does: task selection, moving tasks between
// deliveries (buttons or drag), splitting an over-cap epic, the granular agent
// dispatches and a two-tap delete. Keyed by draft id upstream, so switching epics
// starts clean.
export function useDraftEpic({ draft, pointValue, op, ask }: Args) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const epicId = draft.id;
  const ids = [...selected].filter((id) => draft.tasks.some((t) => t.id === id));
  const selTasks = draft.tasks.filter((t) => selected.has(t.id));
  const selPoints = draftPoints({ tasks: selTasks });
  const clear = () => setSelected(new Set());

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const setMany = (taskIds: string[], on: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    for (const id of taskIds) if (on) next.add(id); else next.delete(id);
    return next;
  });

  const moveTo = (deliveryId: string) => { op({ op: 'move-tasks', epicId, taskIds: ids, deliveryId }); clear(); };
  const moveToNew = () => { op({ op: 'add-delivery', epicId, taskIds: ids }); clear(); };
  // Dragging a selected row carries the whole selection; an unselected row goes alone.
  const drop = (deliveryId: string, taskId: string) => {
    op({ op: 'move-tasks', epicId, taskIds: selected.has(taskId) ? ids : [taskId], deliveryId });
    if (selected.has(taskId)) clear();
  };
  const splitSelected = () => { op({ op: 'split-epic', id: epicId, taskIds: ids }); clear(); };
  const split = suggestSplit(draft, pointValue);
  const autoSplit = () => op({ op: 'split-epic', id: epicId, taskIds: split });

  const clickDelete = () => {
    if (timer.current) clearTimeout(timer.current);
    if (armed) { setArmed(false); op({ op: 'delete-epic', id: epicId }); return; }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3000);
  };

  return {
    cap: draftCap(draft, pointValue),
    progress: draftProgress(draft),
    pending: draft.tasks.filter((t) => t.status === 'draft').length,
    selected, toggle, setMany, clear,
    selection: { count: ids.length, points: selPoints, valueCents: centsFromPoints(selPoints, pointValue), pending: selTasks.filter((t) => t.status === 'draft').length },
    moveTo, moveToNew, drop, splitSelected, canAutoSplit: split.length > 0, autoSplit,
    armed, clickDelete,
    resetStatus: () => op({ op: 'set-status', id: epicId, status: 'draft' }),
    createAll: () => ask(draft.status === 'draft' && draftProgress(draft) === 'partial' ? 'Criar o restante do épico no DFL' : 'Criar épico no DFL', [epicUnit(draft)]),
    createDelivery: (deliveryId: string) => ask('Criar só esta delivery no DFL', [deliveryUnit(draft, deliveryId)]),
    createSelected: () => { ask(`Criar ${ids.length === 1 ? 'task selecionada' : 'tasks selecionadas'} no DFL`, [selectionUnit(draft, selected)]); },
  };
}
