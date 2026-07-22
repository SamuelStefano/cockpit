import { useState } from 'react';
import type { DflProjectNode } from '../../../shared/protocol';
import { Icon, EmptyState } from '../../components/primitives';
import { TaskRow } from './TaskRow';
import { brl } from './money';

interface Props {
  projects: DflProjectNode[];
}

// Árvore projeto›épico›delivery›task. Projetos e deliveries colapsáveis; o épico é
// um agrupador leve (título) pra não afundar demais a hierarquia visual.
export function DflTree({ projects }: Props) {
  if (!projects.length) {
    return <EmptyState icon="grip" title="Sem dados do DFL" description="Rode a sincronização pra puxar projetos, entregas e tarefas." />;
  }
  return <div className="space-y-2">{projects.map((p) => <ProjectBlock key={p.id} project={p} />)}</div>;
}

function ProjectBlock({ project }: { project: DflProjectNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 hairline">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} className="text-neutral-500" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-100">{project.name}</span>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-orange-300">{project.points} pts</span>
        <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-500">{brl(project.amountCents)}</span>
      </button>
      {open && (
        <div className="border-t border-neutral-800/70 px-2 pb-2 pt-1">
          {project.epics.map((ep) => (
            <div key={ep.id} className="mt-1">
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-neutral-500">{ep.name}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">{ep.points} pts</span>
              </div>
              {ep.deliveries.map((d) => (
                <div key={d.id} className="ml-2 border-l border-neutral-800 pl-2">
                  <div className="flex items-center gap-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-400">{d.name}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-neutral-600">{brl(d.pricePerPoint * 100)}/pt</span>
                  </div>
                  {d.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
