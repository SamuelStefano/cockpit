import type { DragEvent } from 'react';
import type { PlannerTask } from '../../../shared/planner';
import { Icon } from '../primitives';
import { adjacentColumn, COLUMN_LABELS, taskXp } from '../../planner/planner-logic';
import { DifficultyPips } from './DifficultyPips';

interface PlannerCardProps {
  task: PlannerTask;
  index: number;
  dragging: boolean;
  dropBefore: boolean;
  floatXp?: number;
  onOpen: () => void;
  onMoveColumn: (dir: -1 | 1) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
}

function MoveButton({ dir, label, onClick }: { dir: -1 | 1; label: string; onClick: () => void }) {
  return (
    <button
      type="button" aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 pointer-coarse:h-9 pointer-coarse:w-9"
    >
      <Icon name={dir < 0 ? 'chevronLeft' : 'chevronRight'} size={14} />
    </button>
  );
}

export function PlannerCard({ task, index, dragging, dropBefore, floatXp, onOpen, onMoveColumn, onDragStart, onDragEnd, onDragOver }: PlannerCardProps) {
  const prev = adjacentColumn(task.column, -1);
  const next = adjacentColumn(task.column, 1);
  const done = task.column === 'done';
  return (
    <div
      className={`stagger-in relative ${dropBefore ? 'before:absolute before:-top-1.5 before:left-0 before:right-0 before:h-0.5 before:rounded-full before:bg-orange-500' : ''}`}
      style={{ '--i': index } as React.CSSProperties} onDragOver={onDragOver}
    >
      {floatXp != null && (
        <span className="xp-float pointer-events-none absolute right-2 top-0 z-10 font-display text-[15px] font-bold text-green-400">+{floatXp} XP</span>
      )}
      <div
        role="button" tabIndex={0} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
        onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        className={`group cursor-grab rounded-xl border border-neutral-800 bg-neutral-900 p-2.5 transition hover:-translate-y-px hover:border-orange-500/40 active:cursor-grabbing focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${dragging ? 'opacity-40' : ''}`}
      >
        <p className={`text-[13px] leading-snug ${done ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>{task.title}</p>
        {task.description && <p className="mt-1 line-clamp-2 whitespace-pre-line text-[12px] text-neutral-500">{task.description}</p>}
        <div className="mt-2 flex items-center gap-2">
          <DifficultyPips value={task.difficulty} />
          <span className="font-mono text-[12px] text-neutral-500">{taskXp(task)} XP</span>
          {task.links.length > 0 && <Icon name="link" size={12} className="text-neutral-500" />}
          <span className="ml-auto flex items-center">
            {prev && <MoveButton dir={-1} label={`Mover para ${COLUMN_LABELS[prev]}`} onClick={() => onMoveColumn(-1)} />}
            {next && <MoveButton dir={1} label={`Mover para ${COLUMN_LABELS[next]}`} onClick={() => onMoveColumn(1)} />}
          </span>
        </div>
      </div>
    </div>
  );
}
