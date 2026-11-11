import { useState } from 'react';
import type { PlannerColumn as Column, PlannerTask } from '../../../shared/planner';
import { PLANNER_COLUMNS } from '../../../shared/planner';
import { Tabs } from '../primitives';
import { COLUMN_LABELS, columnTasks, hiddenDoneCount } from '../../planner/planner-logic';
import { usePlannerDnd } from '../../planner/usePlannerDnd';
import { PlannerColumn } from './PlannerColumn';

interface PlannerBoardProps {
  tasks: PlannerTask[];
  now: number;
  showAllDone: boolean;
  floats: Record<string, number>;
  onToggleAllDone: () => void;
  onAdd: (column: Column, title: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, column: Column, index: number) => void;
}

export function PlannerBoard({ tasks, now, showAllDone, floats, onToggleAllDone, onAdd, onOpen, onMove }: PlannerBoardProps) {
  const [mobile, setMobile] = useState<Column>('today');
  const dnd = usePlannerDnd(tasks, showAllDone, onMove);
  const tabs = PLANNER_COLUMNS.map((c) => ({ id: c, label: COLUMN_LABELS[c], count: columnTasks(tasks, c, { showAllDone, now }).length }));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Tabs className="px-2 md:hidden" items={tabs} active={mobile} onChange={setMobile} compact />
      <div className="flex min-h-0 flex-1 gap-3 p-3 max-md:p-2">
        {PLANNER_COLUMNS.map((c) => {
          const list = columnTasks(tasks, c, { showAllDone, now });
          const here = dnd.over?.column === c;
          return (
            <PlannerColumn
              key={c} column={c} tasks={list} hiddenDone={hiddenDoneCount(tasks, now)} showAllDone={showAllDone} floats={floats}
              className={c === mobile ? '' : 'max-md:hidden'} onToggleAllDone={onToggleAllDone}
              onAdd={(title) => onAdd(c, title)} onOpen={onOpen} onMove={onMove}
              dnd={{
                dragId: dnd.dragId, overIndex: here ? dnd.over!.index : null, startDrag: dnd.startDrag, reset: dnd.reset,
                overCard: (e, i) => dnd.overCard(e, c, i), overColumn: (e) => dnd.overColumn(e, c, list.length), drop: (e) => dnd.drop(e, c),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
