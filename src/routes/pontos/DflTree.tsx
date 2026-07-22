import { useState } from 'react';
import type { DflProjectNode } from '../../../shared/protocol';
import { Icon, EmptyState, ProgressBar } from '../../components/primitives';
import { DflDelivery } from './DflDelivery';
import { brl, fmtPts } from './money';
import { filterProjects, projectStatusPoints, redundantEpicHeader, type TreeFilter } from './treeFilter';

const FILTERS: { id: TreeFilter; label: string; on: string }[] = [
  { id: 'all', label: 'Todos', on: 'border-neutral-600 bg-neutral-800 text-neutral-100' },
  { id: 'paid', label: 'Pago', on: 'border-green-500/40 bg-green-500/15 text-green-300' },
  { id: 'open', label: 'Em aberto', on: 'border-orange-500/40 bg-orange-500/15 text-orange-300' },
  { id: 'todo', label: 'A fazer', on: 'border-neutral-600 bg-neutral-800 text-neutral-200' },
];

// Árvore projeto›épico›delivery›task com filtro por status. Deliveries fecham por
// padrão (o resumo por chips basta); com filtro ativo abrem já expandidas.
export function DflTree({ projects }: { projects: DflProjectNode[] }) {
  const [filter, setFilter] = useState<TreeFilter>('all');
  if (!projects.length) {
    return <EmptyState icon="grip" title="Sem dados do DFL" description="Rode a sincronização pra puxar projetos, entregas e tarefas." />;
  }
  const shown = filterProjects(projects, filter);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              filter === f.id ? f.on : 'border-neutral-800 bg-transparent text-neutral-500 hover:text-neutral-300'}`}>
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0
        ? <p className="py-8 text-center text-[12px] text-neutral-600">Nada com esse status.</p>
        : <div className="space-y-2.5">{shown.map((p) => <ProjectBlock key={p.id} project={p} expandAll={filter !== 'all'} />)}</div>}
    </div>
  );
}

function ProjectBlock({ project, expandAll }: { project: DflProjectNode; expandAll: boolean }) {
  const [open, setOpen] = useState(true);
  const sp = projectStatusPoints(project);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 hairline">
      <button onClick={() => setOpen((v) => !v)} className="block w-full px-3.5 py-2.5 text-left">
        <div className="flex items-center gap-2">
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} className="shrink-0 text-neutral-500" />
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-neutral-100">{project.name}</span>
          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-orange-300">{fmtPts(project.points)} pts</span>
          <span className="w-24 shrink-0 text-right text-[12px] tabular-nums text-neutral-400">{brl(project.amountCents)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 pl-[21px]">
          <ProgressBar className="flex-1" segments={[
            { value: sp.paid, tone: 'green', label: `pago: ${fmtPts(sp.paid)} pts` },
            { value: sp.open, tone: 'orange', label: `aberto: ${fmtPts(sp.open)} pts` },
            { value: sp.todo, tone: 'neutral', label: `a fazer: ${fmtPts(sp.todo)} pts` },
          ]} />
          <span className="shrink-0 text-[10.5px] tabular-nums text-neutral-600">
            {fmtPts(sp.paid)} pago · {fmtPts(sp.open)} aberto{sp.todo > 0 ? ` · ${fmtPts(sp.todo)} a fazer` : ''}
          </span>
        </div>
      </button>
      {open && (
        <div className="space-y-2 border-t border-neutral-800/70 px-3 pb-3 pt-2">
          {project.epics.map((ep) => (
            <div key={ep.id}>
              {!redundantEpicHeader(ep) && (
                <div className="flex items-baseline gap-2 px-0.5 py-1">
                  <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{ep.name}</span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-neutral-600">{fmtPts(ep.points)} pts · {brl(ep.amountCents)}</span>
                </div>
              )}
              <div className="space-y-1.5">
                {/* key inclui o modo: trocar o filtro remonta e reaplica o defaultOpen */}
                {ep.deliveries.map((d) => <DflDelivery key={`${d.id}:${expandAll}`} delivery={d} defaultOpen={expandAll} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
