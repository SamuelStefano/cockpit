import { Button, EmptyState } from '../../components/primitives';
import type { BotView } from '../equipe/team-view';
import { DepartmentRoom } from './DepartmentRoom';
import { buildRooms, summarize } from './office-view';

interface OfficeProps { views: BotView[]; onOpen: (id: string) => void; onNew?: () => void; heading?: boolean }

const chip = 'rounded-[10px] border border-neutral-800 px-2.5 py-1 text-[13px] text-neutral-400';

export function Office({ views, onOpen, onNew, heading = true }: OfficeProps) {
  if (views.length === 0) {
    return (
      <EmptyState size="sm" icon="users" title="Nenhum agente ainda" description="Crie o primeiro agente e ele aparece aqui, no setor dele.">
        {onNew && <Button variant="primary" size="md" icon="plus" onClick={onNew}>Novo agente</Button>}
      </EmptyState>
    );
  }
  const s = summarize(views);
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Resumo" className="flex flex-wrap items-center gap-2">
        {heading ? <h1 className="mr-auto text-[22px] font-semibold tracking-[-0.02em] text-neutral-100 max-lg:hidden">Escritório</h1> : <span className="mr-auto" />}
        <span className={chip}><b className="mr-1 font-semibold text-white">{s.total}</b>{s.total === 1 ? 'agente' : 'agentes'}</span>
        <span className={chip}><b className="mr-1 font-semibold text-white">{s.working}</b>trabalhando</span>
        <span className={chip}><b className="mr-1 font-semibold text-white">{s.waiting}</b>esperando você</span>
        {onNew && <Button variant="secondary" size="sm" icon="plus" onClick={onNew}>Novo agente</Button>}
      </div>
      <div className="gap-3.5 md:columns-2 xl:columns-3">
        {buildRooms(views).map((room) => <DepartmentRoom key={room.key} room={room} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
