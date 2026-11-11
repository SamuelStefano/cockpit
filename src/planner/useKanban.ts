import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlannerColumn, PlannerTask } from '../../shared/planner';
import { fireConfetti } from '../components/primitives';
import { sfx, soundOn } from '../game/sfx';
import { levelUpOnDone, newTaskId, taskXp, topOrder } from './planner-logic';
import type { PlannerApi } from './usePlanner';

const FLOAT_MS = 1400;

export function useKanban(api: PlannerApi) {
  const { tasks, onPlannerSave, onPlannerMove } = api;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [floats, setFloats] = useState<Record<string, number>>({});
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const celebrate = useCallback((task: PlannerTask) => {
    setFloats((f) => ({ ...f, [task.id]: taskXp(task) }));
    timers.current.push(setTimeout(() => setFloats((f) => { const { [task.id]: _, ...rest } = f; return rest; }), FLOAT_MS));
    const level = levelUpOnDone(tasks, task);
    if (level) {
      setLevelUp(level);
      timers.current.push(setTimeout(() => setLevelUp(null), 1600));
    }
    fireConfetti({ count: level ? 220 : 60 });
    if (soundOn()) (level ? sfx.achievement : sfx.levelUp)();
  }, [tasks]);

  const move = useCallback((id: string, column: PlannerColumn, index: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    onPlannerMove(id, column, index);
    if (column === 'done' && task.column !== 'done') celebrate(task);
  }, [tasks, onPlannerMove, celebrate]);

  const add = useCallback((column: PlannerColumn, title: string) => {
    const now = Date.now();
    onPlannerSave({
      id: newTaskId(), title: title.trim().slice(0, 140), description: '', links: [], difficulty: 1,
      column, order: topOrder(tasks, column), createdAt: now, updatedAt: now,
      ...(column === 'done' ? { doneAt: now } : {}),
    });
  }, [tasks, onPlannerSave]);

  const save = useCallback((task: PlannerTask) => {
    const prev = tasks.find((t) => t.id === task.id);
    onPlannerSave({ ...task, updatedAt: Date.now() });
    if (prev && prev.column !== 'done' && task.column === 'done') celebrate(task);
  }, [tasks, onPlannerSave, celebrate]);

  const remove = useCallback((id: string) => {
    api.onPlannerDelete(id);
    setEditingId(null);
  }, [api]);

  return { levelUp, editingId, setEditingId, showAllDone, setShowAllDone, floats, move, add, save, remove };
}
