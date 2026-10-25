import type { AgentStep, AgentStepKind } from '../../shared/agents';
import { Button } from '../components/primitives';
import { AgentCheck } from './AgentCheck';
import { AgentCopyLine } from './AgentCopyLine';
import './agents.css';

interface AgentStepRowProps {
  step: AgentStep;
  index: number;
  finished: boolean;
  active: boolean;
  running: boolean;
  testing: boolean;
  onRun: (kind: AgentStepKind, command: string) => void;
  onTest: () => void;
}

export function AgentStepRow({ step, index, finished, active, running, testing, onRun, onTest }: AgentStepRowProps) {
  if (finished && !active) {
    return (
      <li className="flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-neutral-500">
        <AgentCheck />
        <span className="truncate">{step.title}</span>
      </li>
    );
  }
  const { command } = step;
  return (
    <li className={`flex gap-2.5 rounded-lg border-l-2 px-3 py-2.5 ${active ? 'agent-step-current border-orange-500 bg-orange-500/5' : 'border-neutral-800'}`}>
      <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${active ? 'bg-orange-500 text-neutral-950' : 'bg-neutral-800 text-neutral-500'}`}>{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-[12.5px] font-medium ${active ? 'text-neutral-100' : 'text-neutral-500'}`}>{step.title}</p>
        {active && <p className="mt-0.5 text-[11.5px] leading-relaxed text-neutral-500">{step.what}</p>}
        {active && command && (
          <div className="mt-2 flex flex-col gap-2">
            <AgentCopyLine command={command} />
            <Button variant="primary" size="md" icon="terminal" className="self-start" loading={running} onClick={() => onRun(step.kind, command)}>
              {running ? 'Rodando no terminal' : 'Rodar no terminal'}
            </Button>
          </div>
        )}
        {active && step.kind === 'test' && (
          <Button variant="primary" size="md" icon="play" className="mt-2" loading={testing} onClick={onTest}>Testar</Button>
        )}
      </div>
    </li>
  );
}
