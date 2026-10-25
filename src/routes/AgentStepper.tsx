import type { AgentStep } from '../../shared/agents';
import { AgentCheck } from './AgentCheck';
import { AgentCopyLine } from './AgentCopyLine';
import './agents.css';

interface AgentStepperProps {
  steps: AgentStep[];
  done: number;
  current: number | null;
}

export function AgentStepper({ steps, done, current }: AgentStepperProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((s, i) => {
        if (i < done) {
          return (
            <li key={s.title} className="flex items-center gap-2.5 px-3 py-1.5 text-[12.5px] text-neutral-500">
              <AgentCheck />
              <span className="truncate">{s.title}</span>
            </li>
          );
        }
        const active = i === current;
        return (
          <li key={s.title} className={`flex gap-2.5 rounded-lg border-l-2 px-3 py-2.5 ${active ? 'agent-step-current border-orange-500 bg-orange-500/5' : 'border-neutral-800'}`}>
            <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${active ? 'bg-orange-500 text-neutral-950' : 'bg-neutral-800 text-neutral-500'}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-[12.5px] font-medium ${active ? 'text-neutral-100' : 'text-neutral-500'}`}>{s.title}</p>
              {active && s.command && <AgentCopyLine command={s.command} />}
              {active && s.hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-neutral-500">{s.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
