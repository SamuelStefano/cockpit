import { useCallback, useState } from 'react';
import type { PlannerColumn, PlannerTask } from '../../shared/planner';
import { newTaskId, topOrder } from './planner-logic';
import type { PlannerApi } from './usePlanner';

export function useKanban(api: PlannerApi) {
  const { tasks, onPlannerSave, onPlannerMove, onPlannerDelete } = api;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);

  const move = useCallback((id: string, column: PlannerColumn, index: number) => {
    onPlannerMove(id, column, index);
  }, [onPlannerMove]);

  const add = useCallback((column: PlannerColumn, title: string) => {
    const now = Date.now();
    onPlannerSave({
      id: newTaskId(), title: title.trim().slice(0, 140), description: '', links: [], difficulty: 1,
      column, order: topOrder(tasks, column), createdAt: now, updatedAt: now,
      ...(column === 'done' ? { doneAt: now } : {}),
    });
  }, [tasks, onPlannerSave]);

  const save = useCallback((task: PlannerTask) => {
    onPlannerSave({ ...task, updatedAt: Date.now() });
  }, [onPlannerSave]);

  const remove = useCallback((id: string) => {
    onPlannerDelete(id);
    setEditingId(null);
  }, [onPlannerDelete]);

  return { editingId, setEditingId, showAllDone, setShowAllDone, move, add, save, remove };
}
