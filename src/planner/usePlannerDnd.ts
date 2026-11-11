import { useCallback, useState, type DragEvent } from 'react';
import type { PlannerColumn, PlannerTask } from '../../shared/planner';
import { columnTasks } from './planner-logic';

export const DRAG_TYPE = 'application/x-planner-task';

interface Over { column: PlannerColumn; index: number }

// `visible` is the filtered list the cards are drawn from; the drop slot is
// mapped back to the full column so a search never scrambles the real order.
export function usePlannerDnd(tasks: PlannerTask[], visible: PlannerTask[], showAllDone: boolean, onMove: (id: string, column: PlannerColumn, index: number) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Over | null>(null);

  const reset = useCallback(() => { setDragId(null); setOver(null); }, []);

  const startDrag = useCallback((e: DragEvent, id: string) => {
    e.dataTransfer.setData(DRAG_TYPE, id);
    e.dataTransfer.effectAllowed = 'move';
    setDragId(id);
  }, []);

  const overCard = useCallback((e: DragEvent, column: PlannerColumn, index: number) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const next = e.clientY < r.top + r.height / 2 ? index : index + 1;
    setOver((o) => (o?.column === column && o.index === next ? o : { column, index: next }));
  }, [dragId]);

  const overColumn = useCallback((e: DragEvent, column: PlannerColumn, size: number) => {
    if (!dragId) return;
    e.preventDefault();
    setOver((o) => (o?.column === column ? o : { column, index: size }));
  }, [dragId]);

  const drop = useCallback((e: DragEvent, column: PlannerColumn) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragId;
    const slot = over?.column === column ? over.index : Number.MAX_SAFE_INTEGER;
    reset();
    if (!id) return;
    const shown = columnTasks(visible, column, { showAllDone });
    if (column === 'done' && shown.some((t) => t.id === id)) return;
    const from = shown.findIndex((t) => t.id === id);
    const anchor = shown.filter((t) => t.id !== id)[from >= 0 && from < slot ? slot - 1 : slot];
    const rest = columnTasks(tasks, column, { showAllDone: true }).filter((t) => t.id !== id);
    const at = anchor ? rest.findIndex((t) => t.id === anchor.id) : -1;
    onMove(id, column, at >= 0 ? at : rest.length);
  }, [dragId, over, reset, tasks, visible, showAllDone, onMove]);

  return { dragId, over, startDrag, overCard, overColumn, drop, reset };
}
