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
        setHarnessEvents((prev) => ({ ...prev, [msg.taskId]: [...(prev[msg.taskId] ?? []), msg.event] }));
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
