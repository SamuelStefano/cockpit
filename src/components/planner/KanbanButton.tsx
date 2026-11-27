import { useState } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import { Badge, Button } from '../primitives';
import { todayPendingCount } from '../../planner/planner-logic';
import type { PlannerApi } from '../../planner/usePlanner';
import { KanbanModal } from './KanbanModal';

export function KanbanButton({ planner, bots }: { planner: PlannerApi; bots?: TeamBot[] }) {
  const [open, setOpen] = useState(false);
  const pending = todayPendingCount(planner.tasks);
  return (
    <>
      <Button
        variant="ghost" size="xs" icon="layers" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Kanban"
        aria-label={pending ? `Kanban, ${pending} para hoje` : 'Kanban'}
        className="relative pointer-coarse:h-11"
      >
        <span className="max-md:hidden">Kanban</span>
        {pending > 0 && <Badge tone="orange" className="ml-1.5 max-md:absolute max-md:-right-0.5 max-md:-top-0.5">{pending}</Badge>}
      </Button>
      <KanbanModal open={open} onClose={() => setOpen(false)} planner={planner} bots={bots} />
    </>
  );
}
