import { Icon } from '../components/primitives';
import type { CustomAgentOutcome } from '../cockpit/useAgents';

export function AgentCustomOutcome({ outcome }: { outcome: CustomAgentOutcome | null }) {
  if (!outcome || (!outcome.ok && outcome.field)) return null;
  const tone = outcome.ok ? 'border-green-500/25 bg-green-500/5 text-green-200' : 'border-red-500/25 bg-red-500/5 text-red-200';
  return (
    <p role="status" className={`flex gap-2 rounded-lg border px-3 py-2 text-[13px] leading-relaxed wrap-anywhere ${tone}`}>
      <Icon name={outcome.ok ? 'check' : 'alertTriangle'} size={13} className="mt-0.5 shrink-0" />
      <span>{outcome.message}</span>
    </p>
  );
}
