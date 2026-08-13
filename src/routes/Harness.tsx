import { useEffect } from 'react';
import { Badge, EmptyState, RouteHeader } from '../components/primitives';
import type { HarnessConfig, HarnessContext, HarnessEvent, HarnessModelChoice, HarnessTaskView } from '../../shared/protocol';
import { HarnessComposer } from './harness/HarnessComposer';
import { HarnessFeed } from './harness/HarnessFeed';
import { HarnessHistory } from './harness/HarnessHistory';
import type { useHarnessDraft } from './harness/useHarnessDraft';

interface Props {
  connected: boolean;
  config: HarnessConfig | null;
  tasks: HarnessTaskView[];
  events: Record<string, HarnessEvent[]>;
  onHarnessGet: () => void;
  onHarnessRun: (prompt: string, model: HarnessModelChoice, context: HarnessContext) => void;
}

export function Harness(p: Props) {
  useEffect(() => { if (p.connected) p.onHarnessGet(); }, [p.connected, p.onHarnessGet]);

  const active = p.tasks[0] ?? null;
  const running = active?.status === 'running';

  const handleRun = (prompt: string, d: ReturnType<typeof useHarnessDraft>) => {
    p.onHarnessRun(prompt, d.choice, d.context);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <RouteHeader
        variant="bar"
        title="harness"
        badge={<Badge tone="orange">motor próprio</Badge>}
        subtitle="orquestração sua · modelo sempre selecionável · classificador de complexidade"
      />

      {!p.connected ? (
        <EmptyState icon="circle" title="Desconectado" description="Reconecte pra usar o harness." />
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
            <div className="flex flex-col gap-3">
              <HarnessComposer config={p.config} running={running} onRun={handleRun} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <HarnessFeed task={active} events={active ? p.events[active.id] ?? [] : []} />
              <HarnessHistory tasks={p.tasks} activeId={active?.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
