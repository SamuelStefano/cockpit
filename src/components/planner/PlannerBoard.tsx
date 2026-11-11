import { useState } from 'react';
import type { PlannerColumn as Column, PlannerTask } from '../../../shared/planner';
import { PLANNER_COLUMNS } from '../../../shared/planner';
import { Tabs } from '../primitives';
import { useCoarse } from '../primitives/useCoarse';
import { COLUMN_LABELS, columnTasks, hiddenDoneCount } from '../../planner/planner-logic';
import { usePlannerDnd } from '../../planner/usePlannerDnd';
import { PlannerColumn } from './PlannerColumn';

interface PlannerBoardProps {
  tasks: PlannerTask[];
  visible: PlannerTask[];
  filtering: boolean;
  now: number;
  showAllDone: boolean;
  onToggleAllDone: () => void;
  onAdd: (column: Column, title: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, column: Column, index: number) => void;
}

export function PlannerBoard({ tasks, visible, filtering, now, showAllDone, onToggleAllDone, onAdd, onOpen, onMove }: PlannerBoardProps) {
  const coarse = useCoarse();
  const [mobile, setMobile] = useState<Column>('today');
  const dnd = usePlannerDnd(tasks, visible, showAllDone, onMove);
  const lists = Object.fromEntries(PLANNER_COLUMNS.map((c) => [c, columnTasks(visible, c, { showAllDone, now })])) as Record<Column, PlannerTask[]>;
  const tabs = PLANNER_COLUMNS.map((c) => ({ id: c, label: COLUMN_LABELS[c], count: lists[c].length }));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs className="px-2 md:hidden" items={tabs} active={mobile} onChange={setMobile} compact />
      <div className="flex min-h-0 flex-1 gap-2 px-3 pb-3 pt-2 max-md:p-2">
        {PLANNER_COLUMNS.map((c) => (
          <PlannerColumn
            key={c} column={c} tasks={lists[c]} filtering={filtering} coarse={coarse} hiddenDone={hiddenDoneCount(visible, now)} showAllDone={showAllDone}
            className={c === mobile ? '' : 'max-md:hidden'} onToggleAllDone={onToggleAllDone}
            onAdd={(title) => onAdd(c, title)} onOpen={onOpen} onMove={onMove}
            dnd={{
              dragId: dnd.dragId, overIndex: dnd.over?.column === c ? dnd.over.index : null, startDrag: dnd.startDrag, reset: dnd.reset,
              overCard: (e, i) => dnd.overCard(e, c, i), overColumn: (e) => dnd.overColumn(e, c, lists[c].length), drop: (e) => dnd.drop(e, c),
            }}
          />
        ))}
      </div>
    </div>
  );
}
