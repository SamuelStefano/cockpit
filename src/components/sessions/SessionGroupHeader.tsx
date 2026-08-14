import { Icon } from '../primitives/Icon';
import { RUNNING_LABEL, WAITING_LABEL } from './group-by-recency';

const TONE: Record<string, string> = {
  [RUNNING_LABEL]: 'text-green-400/90',
  [WAITING_LABEL]: 'text-orange-400/90',
};

export function SessionGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className={`sticky top-0 z-[1] -mx-2.5 flex items-center gap-1.5 bg-neutral-950/95 px-3.5 pb-1 pt-2 font-mono text-[9.5px] font-medium uppercase tracking-[0.12em] backdrop-blur-sm ${TONE[label] ?? 'text-neutral-500'}`}>
      {label === RUNNING_LABEL && <span className="breathe h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />}
      {label === WAITING_LABEL && <Icon name="message" size={9} className="shrink-0" />}
      {label === 'Fixadas' && <Icon name="star" size={9} className="shrink-0 text-orange-400/80" />}
      <span className="shrink-0">{label}</span>
      <span className="shrink-0 font-medium text-neutral-600 tabular-nums">{count}</span>
      <span className="h-px min-w-3 flex-1 bg-gradient-to-r from-neutral-800 to-transparent" />
    </div>
  );
}
