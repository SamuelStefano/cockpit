import type { AgentStep } from '../../shared/agents';
import { AgentCopyLine } from './AgentCopyLine';

export function AgentSteps({ steps, activeStep }: { steps: AgentStep[]; activeStep: number }) {
  return (
    <ol className="mt-3 flex flex-col gap-2">
      {steps.map((s, i) => {
        const active = i === activeStep;
        return (
          <li key={s.title} className={`flex gap-3 rounded-lg border px-3 py-2.5 ${active ? 'border-orange-500/40 bg-orange-500/5' : 'border-neutral-800 bg-neutral-900/30'}`}>
            <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${active ? 'bg-orange-500 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-[12.5px] font-medium ${active ? 'text-neutral-100' : 'text-neutral-300'}`}>{s.title}</p>
              {s.command && <AgentCopyLine command={s.command} />}
              {s.hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-neutral-500">{s.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
