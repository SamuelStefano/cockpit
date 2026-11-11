import { useCallback, useMemo, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { PlannerColumn, PlannerMove, PlannerTask } from '../../shared/planner';
import { applyMovesLocal, planMove } from './planner-logic';

export interface PlannerApi {
  tasks: PlannerTask[];
  loaded: boolean;
  onPlannerGet: () => void;
  onPlannerSave: (task: PlannerTask) => void;
  onPlannerDelete: (id: string) => void;
  onPlannerMove: (id: string, column: PlannerColumn, index: number) => PlannerMove | null;
  onMsg: (msg: ServerMsg) => boolean;
}

export function usePlanner(send: (m: ClientMsg) => boolean): PlannerApi {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(tasks);
  latest.current = tasks;

  const onPlannerGet = useCallback(() => { send({ t: 'planner-get' }); }, [send]);

  const onPlannerSave = useCallback((task: PlannerTask) => {
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]));
    send({ t: 'planner-task-save', task });
  }, [send]);

  const onPlannerDelete = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    send({ t: 'planner-task-delete', id });
  }, [send]);

  const onPlannerMove = useCallback((id: string, column: PlannerColumn, index: number) => {
    const move = planMove(latest.current, id, column, index);
    if (!move) return null;
    const next = applyMovesLocal(latest.current, [move], Date.now());
    latest.current = next;
    setTasks(next);
    send({ t: 'planner-reorder', moves: [move] });
    return move;
  }, [send]);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t !== 'planner-board') return false;
    setTasks(msg.tasks);
    setLoaded(true);
    return true;
  }, []);

  return useMemo(
    () => ({ tasks, loaded, onPlannerGet, onPlannerSave, onPlannerDelete, onPlannerMove, onMsg }),
    [tasks, loaded, onPlannerGet, onPlannerSave, onPlannerDelete, onPlannerMove, onMsg],
  );
}
