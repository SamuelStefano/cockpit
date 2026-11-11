import { useEffect, useState } from 'react';
import { Modal } from '../primitives';
import { PlannerBoard } from './PlannerBoard';
import { PlannerStats } from './PlannerStats';
import { TaskEditor } from './TaskEditor';
import { useKanban } from '../../planner/useKanban';
import type { PlannerApi } from '../../planner/usePlanner';

export function KanbanModal({ open, onClose, planner }: { open: boolean; onClose: () => void; planner: PlannerApi }) {
  const k = useKanban(planner);
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
    <Modal open={open} onClose={onClose} title="Kanban" icon="layers" fill pop maxWidth="max-w-6xl">
      <PlannerStats tasks={planner.tasks} now={now} levelUp={k.levelUp} />
      {editing ? (
        <TaskEditor key={editing.id} task={editing} onSave={k.save} onDelete={k.remove} onBack={() => k.setEditingId(null)} />
      ) : (
        <PlannerBoard
          tasks={planner.tasks} now={now} showAllDone={k.showAllDone} floats={k.floats}
          onToggleAllDone={() => k.setShowAllDone((v) => !v)} onAdd={k.add} onOpen={k.setEditingId} onMove={k.move}
        />
      )}
    </Modal>
  );
}
