import { Icon } from '../components/primitives';
import { NEXT_ACTION } from '../cockpit/agents-view';
import type { AgentStatus } from '../../shared/agents';

export function AgentCallout({ status, message }: { status: AgentStatus; message?: string }) {
  // The highlighted step already says what is missing; only a failure needs a headline.
  const next = status === 'error' ? NEXT_ACTION.error : undefined;
  if (!message && !next) return null;
  return (
    <div role="status" className="flex gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2.5">
      <Icon name="sparkles" size={14} className="mt-0.5 shrink-0 text-orange-400" />
      <div className="min-w-0 text-[12px] leading-relaxed">
        {next && <p className="font-medium text-neutral-200">{next}</p>}
        {message && <p className="wrap-anywhere text-neutral-500">{message}</p>}
      </div>
    </div>
  );
}
