import type { DragEvent } from 'react';
import type { PlannerColumn as Column, PlannerTask } from '../../../shared/planner';
import { Button } from '../primitives';
import { COLUMN_DOT, COLUMN_LABELS } from '../../planner/planner-logic';
import { useColumnPage } from '../../planner/useColumnPage';
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
  filtering: boolean;
  coarse: boolean;
  hiddenDone: number;
  showAllDone: boolean;
  dnd: ColumnDnd;
  className?: string;
  onToggleAllDone: () => void;
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, column: Column, index: number) => void;
}

const EMPTY: Record<Column, string> = { today: 'Nada para hoje.', week: 'Semana livre.', backlog: 'Sem pendências.', done: 'Nada feito ainda.' };

export function PlannerColumn({ column, tasks, filtering, coarse, hiddenDone, showAllDone, dnd, className = '', onToggleAllDone, onAdd, onOpen, onMove }: PlannerColumnProps) {
  const page = useColumnPage(tasks);
  const over = dnd.overIndex !== null;
  return (
    <section
      aria-label={COLUMN_LABELS[column]} onDragOver={dnd.overColumn} onDrop={dnd.drop}
      className={`flex min-h-0 min-w-0 flex-1 flex-col rounded-xl transition-colors ${over ? 'bg-neutral-800/30' : 'bg-neutral-950/40'} ${className}`}
    >
      <header className="flex items-center gap-2 px-3 pb-1.5 pt-2.5 max-md:hidden">
        <span className={`h-1.5 w-1.5 rounded-full ${COLUMN_DOT[column]}`} aria-hidden />
        <h3 className="text-[13px] font-medium text-neutral-300">{COLUMN_LABELS[column]}</h3>
        <span className="text-[12px] tabular-nums text-neutral-600">{tasks.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-1.5 pb-2 [scrollbar-width:thin]">
        {column !== 'done' && <PlannerAdd onAdd={onAdd} />}
        {tasks.length === 0 && <p className="px-2 py-3 text-[12px] text-neutral-600">{filtering ? 'Nada encontrado.' : EMPTY[column]}</p>}
        {page.shown.map((t, i) => (
          <PlannerCard
            key={t.id} task={t} dragging={dnd.dragId === t.id} coarse={coarse} dropBefore={dnd.overIndex === i}
            onOpen={() => onOpen(t.id)} onMoveTo={(to) => onMove(t.id, to, 0)}
            onDragStart={(e) => dnd.startDrag(e, t.id)} onDragEnd={dnd.reset} onDragOver={(e) => dnd.overCard(e, i)}
          />
        ))}
        {dnd.overIndex === page.shown.length && page.shown.length > 0 && <div className="mx-1 h-0.5 shrink-0 rounded-full bg-orange-500" />}
        {page.hidden > 0 && <Button variant="ghost" size="xs" onClick={page.more}>mostrar mais ({page.hidden})</Button>}
        {column === 'done' && (hiddenDone > 0 || showAllDone) && (
          <Button variant="ghost" size="xs" onClick={onToggleAllDone}>{showAllDone ? 'só últimos 7 dias' : `ver todas (+${hiddenDone})`}</Button>
        )}
      </div>
    </section>
  );
}
