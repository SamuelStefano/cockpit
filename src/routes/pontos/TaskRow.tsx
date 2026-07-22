import type { DflTaskNode, DflTaskStatus } from '../../../shared/protocol';
import { Badge } from '../../components/primitives';
import { brl } from './money';

const meta: Record<DflTaskStatus, { tone: 'green' | 'orange' | 'neutral'; label: string }> = {
  paid: { tone: 'green', label: 'pago' },
  open: { tone: 'orange', label: 'aberto' },
  todo: { tone: 'neutral', label: 'a fazer' },
};

export function TaskRow({ task }: { task: DflTaskNode }) {
  const m = meta[task.status];
  return (
    <div className="flex items-center gap-2 py-1.5 pl-2 pr-1">
      <Badge tone={m.tone} dot>{m.label}</Badge>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-neutral-300">{task.name || 'Sem título'}</span>
      <span className="shrink-0 text-[12px] font-medium tabular-nums text-neutral-200">{task.points} pts</span>
      <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-500">{brl(task.amountCents)}</span>
    </div>
  );
}
