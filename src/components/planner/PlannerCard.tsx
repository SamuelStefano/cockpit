import type { DragEvent } from 'react';
import type { PlannerColumn, PlannerTask } from '../../../shared/planner';
import { Icon, tokens } from '../primitives';
import { CardMeta } from './CardMeta';
import { CardMoveMenu } from './CardMoveMenu';

interface PlannerCardProps {
  task: PlannerTask;
  dragging: boolean;
  coarse: boolean;
  dropBefore: boolean;
  onOpen: () => void;
  onMoveTo: (column: PlannerColumn) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
}

export function PlannerCard({ task, dragging, coarse, dropBefore, onOpen, onMoveTo, onDragStart, onDragEnd, onDragOver }: PlannerCardProps) {
  const done = task.column === 'done';
  return (
    <div className="relative shrink-0" onDragOver={onDragOver}>
      {dropBefore && <div className="absolute -top-1 left-1 right-1 h-0.5 rounded-full bg-orange-500" aria-hidden />}
      <div
        role="button" tabIndex={0} draggable={!coarse} onDragStart={onDragStart} onDragEnd={onDragEnd}
        onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
        className={`group cursor-pointer rounded-lg border border-neutral-800/80 bg-neutral-900 px-3 py-2.5 shadow-sm shadow-black/20 transition duration-150 hover:-translate-y-px hover:border-neutral-700 hover:bg-neutral-900/90 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${tokens.focusRing} ${dragging ? 'opacity-40' : ''} ${done ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start gap-2">
          {done && <Icon name="check" size={13} className="mt-0.5 shrink-0 text-emerald-500/80" />}
          <p className={`line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug ${done ? 'text-neutral-400' : 'text-neutral-100'}`}>{task.title}</p>
          {coarse && <CardMoveMenu column={task.column} onMoveTo={onMoveTo} />}
        </div>
        {task.description && <p className="mt-1 truncate text-[12px] text-neutral-500">{task.description.split('\n').find((l) => l.trim())}</p>}
        <CardMeta task={task} />
      </div>
    </div>
  );
}
