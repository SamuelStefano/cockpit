import type { DflTaskNode, DflTaskStatus } from '../../../shared/protocol';
import { Badge, tokens } from '../../components/primitives';
import { usePontosControls } from './pontosControls';
import { brlShort, fmtPts } from './money';

const META: Record<DflTaskStatus, { tone: 'green' | 'orange' | 'neutral'; label: string }> = {
  paid: { tone: 'green', label: 'paga' },
  open: { tone: 'orange', label: 'aberta' },
  todo: { tone: 'neutral', label: 'a fazer' },
};

const DFL_TASK_GRID = 'grid grid-cols-[64px_minmax(0,1fr)_52px] items-center gap-x-2.5 sm:grid-cols-[64px_minmax(0,1fr)_52px_80px]';

// A DFL task as a table line with its live status. Click opens the points editor
// (the sanctioned DFL workflow, not a direct write).
export function DflTaskRow({ task }: { task: DflTaskNode }) {
  const { setSelectedTask } = usePontosControls();
  const m = META[task.status];
  return (
    <li>
      <button type="button" onClick={() => setSelectedTask(task)} title="Editar pontos"
        className={`${DFL_TASK_GRID} min-h-[34px] w-full px-2.5 py-1 text-left transition hover:bg-neutral-800/30 ${tokens.focusRing}`}>
        <Badge tone={m.tone} dot className="justify-self-start">{m.label}</Badge>
        <span className={`truncate text-[12.5px] ${task.status === 'paid' ? 'text-neutral-400' : 'text-neutral-200'}`}>{task.name || 'Sem título'}</span>
        <span className="text-right font-mono text-[12.5px] font-medium tabular-nums text-neutral-100">
          {fmtPts(task.points)} <span className="text-[10px] text-neutral-500">pt</span>
        </span>
        <span className="hidden text-right font-mono text-[11.5px] tabular-nums text-neutral-500 sm:block">{brlShort(task.amountCents)}</span>
      </button>
    </li>
  );
}
