import type { DflTaskNode, DflTaskStatus } from '../../../shared/protocol';
import { Badge } from '../../components/primitives';
import { brl, fmtPts } from './money';
import { usePontosControls } from './pontosControls';

const meta: Record<DflTaskStatus, { tone: 'green' | 'orange' | 'neutral'; label: string }> = {
  paid: { tone: 'green', label: 'pago' },
  open: { tone: 'orange', label: 'aberto' },
  todo: { tone: 'neutral', label: 'a fazer' },
};

// Clique abre o modal de edição (pontos via workflow sancionado do DFL).
export function TaskCard({ task }: { task: DflTaskNode }) {
  const m = meta[task.status];
  const { setSelectedTask } = usePontosControls();
  return (
    <button
      onClick={() => setSelectedTask(task)}
      className="flex flex-col rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5 text-left transition hover:border-neutral-700 hover:bg-neutral-800/40"
      title="Editar pontos"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <Badge tone={m.tone} dot>{m.label}</Badge>
        <span className="flex items-baseline gap-1 text-xl font-bold tabular-nums tracking-tight text-neutral-100">
          {fmtPts(task.points)}
          <span className="text-[9.5px] font-medium uppercase tracking-wide text-neutral-600">pts</span>
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium leading-snug text-neutral-200">{task.name || 'Sem título'}</p>
      <span className="mt-auto pt-1.5 text-[11.5px] tabular-nums text-neutral-500">{brl(task.amountCents)}</span>
    </button>
  );
}
