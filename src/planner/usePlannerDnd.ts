import { useCallback, useState, type DragEvent } from 'react';
import type { PlannerColumn, PlannerTask } from '../../shared/planner';
import { columnTasks } from './planner-logic';

export const DRAG_TYPE = 'application/x-planner-task';

interface Over { column: PlannerColumn; index: number }

export function usePlannerDnd(tasks: PlannerTask[], showAllDone: boolean, onMove: (id: string, column: PlannerColumn, index: number) => void) {
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
    const list = columnTasks(tasks, column, { showAllDone });
    const from = list.findIndex((t) => t.id === id);
    if (column === 'done' && from >= 0) return;
    const index = from >= 0 && from < slot ? slot - 1 : slot;
    onMove(id, column, Math.min(index, list.length));
  }, [dragId, over, reset, tasks, showAllDone, onMove]);

  return { dragId, over, startDrag, overCard, overColumn, drop, reset };
}
