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

const TASKS_WITH_EVENTS = 20;

// Each `text` event is ONE stream delta, and the feed shows a running task as
// the joined text. Capping the event count cut the start of any long answer
// while it streamed. Consecutive deltas are merged instead, so a task's log
// stays a handful of events (classified, model-selected, text, done) without
// losing anything; only the 20 most recently active tasks keep a log.
export function appendHarnessEvent(prev: Record<string, HarnessEvent[]>, taskId: string, event: HarnessEvent): Record<string, HarnessEvent[]> {
  const cur = prev[taskId] ?? [];
  const last = cur[cur.length - 1];
  const events = event.kind === 'text' && last?.kind === 'text'
    ? [...cur.slice(0, -1), { ...last, text: (last.text ?? '') + (event.text ?? '') }]
    : [...cur, event];
  const next: Record<string, HarnessEvent[]> = { ...prev };
  delete next[taskId];
  next[taskId] = events; // re-inserted last: key order = recency (task ids are UUIDs, never integer-like)
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
        // Merged and bounded (see appendHarnessEvent): the map used to grow for
        // the whole day-long session.
        setHarnessEvents((prev) => appendHarnessEvent(prev, msg.taskId, msg.event));
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
