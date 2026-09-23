import { useState } from 'react';
import type { DflProjectNode } from '../../../shared/protocol';
import { Icon, EmptyState, ProgressBar, Badge, Button } from '../../components/primitives';
import { DflEpic } from './DflEpic';
import { SelectionBar } from './SelectionBar';
import { usePontosControls } from './pontosControls';
import { brl, fmtPts } from './money';
import { epicCap, type EpicCap } from './epic-cap';
import { filterProjects, projectStatusPoints, type TreeFilter } from './treeFilter';

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
  const { selecting, setSelecting, clearSelected, pointValue, excluded } = usePontosControls();
  if (!projects.length) {
    return (
      <EmptyState icon="grip" title="Nada do DFL por aqui" className="py-8"
        description="Sincronize no resumo do mês pra puxar projetos, épicos e tasks. O que ainda não existe no DFL fica nos rascunhos acima." />
    );
  }
  const shown = filterProjects(projects, filter);
  const toggleSelecting = () => { setSelecting(!selecting); if (selecting) clearSelected(); };
  // Tetos calculados sobre a árvore INTEIRA (antes do filtro) — ver DflEpic.
  const caps = new Map<string, EpicCap>();
  for (const p of projects) for (const ep of p.epics) caps.set(ep.id, epicCap(ep, { pointValue, excluded }));
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
        <Button variant={selecting ? 'secondary' : 'ghost'} size="sm" icon={selecting ? 'check' : 'square'} className="ml-auto" onClick={toggleSelecting}>
          {selecting ? 'concluir seleção' : 'selecionar p/ faturar'}
        </Button>
      </div>
      {shown.length === 0
        ? <p className="py-8 text-center text-[12px] text-neutral-600">Nada com esse status.</p>
        : <div className="space-y-2">{shown.map((p) => <ProjectBlock key={`${p.id}:${filter}`} project={p} caps={caps} expandAll={filter !== 'all'} />)}</div>}
      {selecting && <SelectionBar projects={projects} />}
    </div>
  );
}

// Projeto quitado (nada aberto/a-fazer) nasce colapsado num one-liner — some da
// vista o que já foi pago. Só projeto com trabalho em aberto (ou filtro ativo)
// abre sozinho. Isso é o que tira a poluição da árvore.
function ProjectBlock({ project, caps, expandAll }: { project: DflProjectNode; caps: Map<string, EpicCap>; expandAll: boolean }) {
  const sp = projectStatusPoints(project);
  const active = sp.open > 0 || sp.todo > 0;
  const [open, setOpen] = useState(expandAll || active);
  return (
    <div className={`overflow-hidden rounded-xl border bg-neutral-900/40 hairline transition-colors ${
      open ? 'border-neutral-800' : 'border-neutral-800/60'}`}>
      <button onClick={() => setOpen((v) => !v)} className="block w-full px-3.5 py-2.5 text-left">
        <div className="flex items-center gap-2">
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} className="shrink-0 text-neutral-500" />
          <span className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold ${active ? 'text-neutral-100' : 'text-neutral-400'}`}>{project.name}</span>
          {!active && <Badge tone="green">quitado</Badge>}
          <span className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${active ? 'text-orange-300' : 'text-neutral-500'}`}>{fmtPts(project.points)} pt</span>
          <span className="w-24 shrink-0 text-right text-[12px] tabular-nums text-neutral-500">{brl(project.amountCents)}</span>
        </div>
        {active && (
          <div className="mt-2 pl-[21px]">
            <ProgressBar segments={[
              { value: sp.paid, tone: 'green', label: `pago: ${fmtPts(sp.paid)} pt` },
              { value: sp.open, tone: 'orange', label: `aberto: ${fmtPts(sp.open)} pt` },
              { value: sp.todo, tone: 'neutral', label: `a fazer: ${fmtPts(sp.todo)} pt` },
            ]} />
          </div>
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-neutral-800/70 px-3 pb-3 pt-2">
          {project.epics.map((ep) => <DflEpic key={ep.id} epic={ep} cap={caps.get(ep.id)} expandAll={expandAll} />)}
        </div>
      )}
    </div>
  );
}
