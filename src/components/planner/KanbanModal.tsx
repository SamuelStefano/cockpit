import { useEffect, useState } from 'react';
import { Modal } from '../primitives';
import { KanbanHeader } from './KanbanHeader';
import { PlannerBoard } from './PlannerBoard';
import { TaskEditor } from './TaskEditor';
import { useKanban } from '../../planner/useKanban';
import { useKanbanFilter } from '../../planner/useKanbanFilter';
import type { PlannerApi } from '../../planner/usePlanner';

export function KanbanModal({ open, onClose, planner }: { open: boolean; onClose: () => void; planner: PlannerApi }) {
  const k = useKanban(planner);
  const f = useKanbanFilter(planner.tasks, open && !k.editingId);
  const [now, setNow] = useState(() => Date.now());
  const { onPlannerGet } = planner;
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    onPlannerGet();
    k.setEditingId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onPlannerGet]);
  const editing = k.editingId ? planner.tasks.find((t) => t.id === k.editingId) : undefined;
  return (
    <Modal open={open} onClose={onClose} label="Kanban" full>
      <KanbanHeader filter={f} total={planner.tasks.length} onClose={onClose} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <PlannerBoard
          tasks={planner.tasks} visible={f.visible} filtering={f.filtering} now={now} showAllDone={k.showAllDone}
          onToggleAllDone={() => k.setShowAllDone((v) => !v)} onAdd={k.add} onOpen={k.setEditingId} onMove={k.move}
        />
        {editing && <TaskEditor key={editing.id} task={editing} onSave={k.save} onDelete={k.remove} onBack={() => k.setEditingId(null)} />}
      </div>
    </Modal>
  );
}
