import { useState } from 'react';
import { Badge, Icon } from '../primitives';
import { todayPendingCount } from '../../planner/planner-logic';
import type { PlannerApi } from '../../planner/usePlanner';
import { KanbanModal } from './KanbanModal';

export function KanbanButton({ planner }: { planner: PlannerApi }) {
  const [open, setOpen] = useState(false);
  const pending = todayPendingCount(planner.tasks);
  return (
    <>
      <button
        type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Kanban"
        aria-label={pending ? `Kanban, ${pending} para hoje` : 'Kanban'}
        className="relative flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] text-neutral-300 hover:bg-neutral-800/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 pointer-coarse:h-11"
      >
        <Icon name="layers" size={16} />
        <span className="max-md:hidden">Kanban</span>
        {pending > 0 && <Badge tone="orange" className="max-md:absolute max-md:-right-0.5 max-md:-top-0.5">{pending}</Badge>}
      </button>
      <KanbanModal open={open} onClose={() => setOpen(false)} planner={planner} />
    </>
  );
}
