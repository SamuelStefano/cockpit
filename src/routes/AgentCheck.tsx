import { Icon } from '../components/primitives';
import './agents.css';

export function AgentCheck() {
  return (
    <span className="agent-check flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300">
      <Icon name="check" size={12} stroke={3} />
    </span>
  );
}
