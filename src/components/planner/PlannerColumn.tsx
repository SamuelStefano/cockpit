import type { DragEvent } from 'react';
import type { PlannerColumn as Column, PlannerTask } from '../../../shared/planner';
import { Button, EmptyState } from '../primitives';
import { COLUMN_ACCENT, COLUMN_LABELS, adjacentColumn } from '../../planner/planner-logic';
import { PlannerAdd } from './PlannerAdd';
import { PlannerCard } from './PlannerCard';

export interface ColumnDnd {
  dragId: string | null;
  overIndex: number | null;
  startDrag: (e: DragEvent, id: string) => void;
  overCard: (e: DragEvent, index: number) => void;
  overColumn: (e: DragEvent) => void;
  drop: (e: DragEvent) => void;
  reset: () => void;
}

interface PlannerColumnProps {
  column: Column;
  tasks: PlannerTask[];
  hiddenDone: number;
  showAllDone: boolean;
  floats: Record<string, number>;
  dnd: ColumnDnd;
  className?: string;
  onToggleAllDone: () => void;
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, column: Column, index: number) => void;
}

const EMPTY: Record<Column, string> = {
  today: 'Nada para hoje. Puxe algo da semana.',
  week: 'Semana livre.',
  backlog: 'Sem pendências.',
  done: 'Nada feito ainda. Bora!',
};

export function PlannerColumn({ column, tasks, hiddenDone, showAllDone, floats, dnd, className = '', onToggleAllDone, onAdd, onOpen, onMove }: PlannerColumnProps) {
  const over = dnd.overIndex !== null;
  return (
    <section
      aria-label={COLUMN_LABELS[column]} onDragOver={dnd.overColumn} onDrop={dnd.drop}
      className={`flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border border-t-2 ${COLUMN_ACCENT[column].border} bg-neutral-950/60 transition ${over ? 'border-orange-500/60 bg-orange-500/5' : 'border-neutral-800'} ${className}`}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2 max-md:hidden">
        <span className={`h-2 w-2 rounded-full ${COLUMN_ACCENT[column].dot}`} />
        <h3 className="text-[12px] font-medium uppercase tracking-[0.06em] text-neutral-400">{COLUMN_LABELS[column]}</h3>
        <span className="rounded-full bg-neutral-800 px-1.5 text-[12px] tabular-nums text-neutral-400">{tasks.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2 pb-2">
        {column !== 'done' && <PlannerAdd onAdd={onAdd} />}
        {tasks.length === 0 && <EmptyState size="xs" title={EMPTY[column]} />}
        {tasks.map((t, i) => (
          <PlannerCard
            key={t.id} task={t} index={i} dragging={dnd.dragId === t.id} dropBefore={dnd.overIndex === i}
            floatXp={floats[t.id]} onOpen={() => onOpen(t.id)}
            onMoveColumn={(dir) => { const to = adjacentColumn(t.column, dir); if (to) onMove(t.id, to, 0); }}
            onDragStart={(e) => dnd.startDrag(e, t.id)} onDragEnd={dnd.reset} onDragOver={(e) => dnd.overCard(e, i)}
          />
        ))}
        {dnd.overIndex === tasks.length && tasks.length > 0 && <div className="h-0.5 shrink-0 rounded-full bg-orange-500" />}
        {column === 'done' && (hiddenDone > 0 || showAllDone) && (
          <Button variant="ghost" size="xs" onClick={onToggleAllDone}>
            {showAllDone ? 'só últimos 7 dias' : `ver todas (+${hiddenDone})`}
          </Button>
        )}
      </div>
    </section>
  );
}
