import { useMemo, useState } from 'react';
import type { ExecutorState, HeavyJob } from '../../../shared/heavy-job';
import { Badge, Button, EmptyState, ToggleChip } from '../../components/primitives';
import type { BotView } from '../equipe/team-view';
import { agentRowsOf, filterBySector, sectorChips, type SectorFilter } from './agent-list';
import { AgentRow } from './AgentRow';
import { executorChip } from './executor/executor-view';
import { summarize } from './office-view';

interface AgentListProps {
  views: BotView[];
  onChat: (id: string) => void;
  onWorkspace: (id: string) => void;
  onNew?: () => void;
  executor?: ExecutorState;
  heavyJobs?: HeavyJob[];
  onOpenExecutor?: () => void;
}

export function AgentList({ views, onChat, onWorkspace, onNew, executor, heavyJobs, onOpenExecutor }: AgentListProps) {
  const [sector, setSector] = useState<SectorFilter>('all');
  const chips = useMemo(() => sectorChips(views), [views]);
  const active = chips.some((c) => c.id === sector) ? sector : 'all';
  const rows = useMemo(() => agentRowsOf(filterBySector(views, active), views), [views, active]);
  const s = summarize(views);
  const executorText = executorChip(executor, heavyJobs);
  if (views.length === 0) {
    return (
      <EmptyState size="sm" icon="users" title="Nenhum agente ainda" description="Crie o primeiro agente e ele aparece aqui, no setor dele.">
        {onNew && <Button variant="primary" size="md" icon="plus" onClick={onNew}>Novo agente</Button>}
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Resumo" className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-[22px] font-semibold tracking-[-0.02em] text-neutral-100 max-lg:hidden">Agentes</h1>
        <Badge>{s.total} {s.total === 1 ? 'agente' : 'agentes'}</Badge>
        <Badge tone="green">{s.working} trabalhando</Badge>
        <Badge tone="yellow">{s.waiting} esperando você</Badge>
        {executorText && (onOpenExecutor
          ? <Badge onClick={onOpenExecutor}>{executorText}</Badge>
          : <Badge>{executorText}</Badge>)}
        {onNew && <Button variant="primary" size="sm" icon="plus" onClick={onNew}>Novo agente</Button>}
      </div>
      {chips.length > 1 && (
        <div role="group" aria-label="Setor" className="flex flex-wrap items-center gap-2">
          {chips.map((c) => <ToggleChip key={c.id} on={c.id === active} aria-pressed={c.id === active} onClick={() => setSector(c.id)}>{c.label}</ToggleChip>)}
        </div>
      )}
      <div role="list" className="rounded-2xl border border-(--border) bg-neutral-900/60">
        {rows.map(({ view, isLeader }) => (
          <div key={view.bot.id} role="listitem"><AgentRow view={view} isLeader={isLeader} onChat={onChat} onWorkspace={onWorkspace} /></div>
        ))}
      </div>
    </div>
  );
}
