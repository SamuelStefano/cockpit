import type { PlannerTask } from '../../../shared/planner';
import { DIFFICULTY_LABELS, linkChipLabel } from '../../planner/planner-logic';

const chip = 'max-w-36 truncate rounded px-1.5 py-px text-[11px] leading-4';
const MAX_LINKS = 2;

export function CardMeta({ task }: { task: PlannerTask }) {
  const { ref, tag, difficulty, links } = task;
  if (!ref && !tag && difficulty === 1 && !links.length && task.source !== 'agent') return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-neutral-500">
      {ref && <span className={`${chip} bg-neutral-800/70 font-mono text-neutral-400`} title={ref}>{ref}</span>}
      {tag && <span className={`${chip} border border-neutral-800 text-neutral-400`}>{tag}</span>}
      {difficulty !== 1 && <span className="px-0.5 text-[11px]">{DIFFICULTY_LABELS[difficulty]}</span>}
      {task.source === 'agent' && <span className="px-0.5 text-[11px] text-neutral-600" title="Criada por um agente">agente</span>}
      {links.length > 0 && (
        <span className="ml-auto flex min-w-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {links.slice(0, MAX_LINKS).map((l) => (
            <a
              key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" draggable={false} title={l.url}
              className={`${chip} text-neutral-400 underline-offset-2 hover:text-orange-300 hover:underline`}
            >{linkChipLabel(l)}</a>
          ))}
          {links.length > MAX_LINKS && <span className="text-[11px]">+{links.length - MAX_LINKS}</span>}
        </span>
      )}
    </div>
  );
}
