import type { TeamBotInput } from '../../../shared/protocol';
import type { ExecutorState, HeavyJob } from '../../../shared/heavy-job';
import { Badge, Button, EmptyState } from '../../components/primitives';
import type { BotView } from '../equipe/team-view';
import { AgentFilters } from './AgentFilters';
import { AgentRow } from './AgentRow';
import { AgentRowMenu } from './AgentRowMenu';
import { DeleteAgentModal } from './DeleteAgentModal';
import { executorChip } from './executor/executor-view';
import { summarize } from './office-view';
import { useAgentActions } from './useAgentActions';
import { useAgentFilters } from './useAgentFilters';

interface AgentListProps {
  views: BotView[];
  onChat: (id: string) => void;
  onWorkspace: (id: string) => void;
  onProfile: (id: string) => void;
  onNew?: () => void;
  onSave?: (bot: TeamBotInput) => void;
  onDelete?: (id: string) => void;
  executor?: ExecutorState;
  heavyJobs?: HeavyJob[];
  onOpenExecutor?: () => void;
}

export function AgentList({ views, onChat, onWorkspace, onProfile, onNew, onSave, onDelete, executor, heavyJobs, onOpenExecutor }: AgentListProps) {
  const f = useAgentFilters(views);
  const actions = useAgentActions({ views, onSave, onDelete, onProfile });
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
        <Badge tone="green" onClick={() => f.setStatus('working')}>{s.working} trabalhando</Badge>
        <Badge tone="yellow" onClick={() => f.setStatus('waiting')}>{s.waiting} esperando você</Badge>
        {executorText && (onOpenExecutor
          ? <Badge onClick={onOpenExecutor}>{executorText}</Badge>
          : <Badge>{executorText}</Badge>)}
        {onNew && <Button variant="primary" size="sm" icon="plus" onClick={onNew}>Novo agente</Button>}
      </div>
      <AgentFilters query={f.query} onQuery={f.setQuery} statuses={f.statuses} status={f.status} onStatus={f.setStatus} sectors={f.sectors} sector={f.sector} onSector={f.setSector} />
      {f.rows.length === 0 ? (
        <EmptyState size="sm" icon="search" title="Nenhum agente encontrado" description="Nenhum agente bate com a busca e os filtros atuais.">
          <Button variant="secondary" size="md" onClick={f.clear}>Limpar filtros</Button>
        </EmptyState>
      ) : (
        <div role="list" className="rounded-2xl border border-(--border) bg-neutral-900/60">
          {f.rows.map(({ view, isLeader }) => (
            <div key={view.bot.id} role="listitem">
              <AgentRow view={view} isLeader={isLeader} onChat={onChat} onWorkspace={onWorkspace} onProfile={onProfile}
                menu={actions.canManage && <AgentRowMenu name={view.bot.name} busy={actions.busy} canDelete={!view.bot.primary} onDuplicate={() => actions.duplicate(view.bot)} onDelete={() => actions.askDelete(view.bot)} />} />
            </div>
          ))}
        </div>
      )}
      <DeleteAgentModal name={actions.toDelete?.name ?? null} onCancel={actions.cancelDelete} onConfirm={actions.confirmDelete} />
    </div>
  );
}
