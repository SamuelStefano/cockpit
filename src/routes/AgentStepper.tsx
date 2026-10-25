import type { AgentStep, AgentStepKind } from '../../shared/agents';
import { AgentStepRow } from './AgentStepRow';

interface AgentStepperProps {
  steps: AgentStep[];
  done: number;
  current: number | null;
  running: AgentStepKind | null;
  testing: boolean;
  onRun: (kind: AgentStepKind, command: string) => void;
  onTest: () => void;
}

export function AgentStepper({ steps, done, current, running, testing, onRun, onTest }: AgentStepperProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((s, i) => (
        <AgentStepRow
          key={s.kind} step={s} index={i} finished={i < done} active={i === current}
          running={running === s.kind} testing={testing} onRun={onRun} onTest={onTest}
        />
      ))}
    </ol>
  );
}
