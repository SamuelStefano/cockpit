import { useCallback, useState } from 'react';
import type { ClientMsg, HarnessConfig, HarnessContext, HarnessEvent, HarnessModelChoice, HarnessTaskView, ServerMsg } from '../../shared/protocol';

export interface Harness {
  harnessConfig: HarnessConfig | null;
  harnessTasks: HarnessTaskView[];
  harnessEvents: Record<string, HarnessEvent[]>;
  onHarnessGet: () => void;
  onHarnessRun: (prompt: string, model: HarnessModelChoice, context: HarnessContext) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const EVENTS_PER_TASK = 200;
const TASKS_WITH_EVENTS = 20;

export function capHarnessEvents<E>(prev: Record<string, E[]>, taskId: string, event: E): Record<string, E[]> {
  const events = [...(prev[taskId] ?? []), event].slice(-EVENTS_PER_TASK);
  const next: Record<string, E[]> = { ...prev };
  delete next[taskId];
  next[taskId] = events; // re-inserted last: key order = recency
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - TASKS_WITH_EVENTS))) delete next[k];
  return next;
}

export function useHarness(send: (m: ClientMsg) => boolean): Harness {
  const [harnessConfig, setHarnessConfig] = useState<HarnessConfig | null>(null);
  const [harnessTasks, setHarnessTasks] = useState<HarnessTaskView[]>([]);
  const [harnessEvents, setHarnessEvents] = useState<Record<string, HarnessEvent[]>>({});

  const onMsg = useCallback((msg: ServerMsg) => {
    switch (msg.t) {
      case 'harness-config':
        setHarnessConfig(msg.config);
        return true;
      case 'harness-tasks':
        setHarnessTasks(msg.tasks);
        return true;
      case 'harness-task':
        // Upsert por id (running → done): mantém a ordem por ts desc.
        setHarnessTasks((prev) => [msg.task, ...prev.filter((t) => t.id !== msg.task.id)].sort((a, b) => b.ts - a.ts));
        return true;
      case 'harness-event':
        // Capped per task, and only the most recent tasks keep their event log: the
        // map used to grow for the whole day-long session.
        setHarnessEvents((prev) => capHarnessEvents(prev, msg.taskId, msg.event));
        return true;
      default:
        return false;
    }
  }, []);

  return {
    harnessConfig,
    harnessTasks,
    harnessEvents,
    onHarnessGet: useCallback(() => { send({ t: 'harness-get' }); }, [send]),
    onHarnessRun: useCallback((prompt: string, model: HarnessModelChoice, context: HarnessContext) => { send({ t: 'harness-run', prompt, model, context }); }, [send]),
    onMsg,
  };
}
