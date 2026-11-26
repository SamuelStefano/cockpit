import type { AgentHistoryApi } from '../../cockpit/useAgentHistory';
import { DiffView } from '../../components/chat/DiffView';
import { Button, EmptyState, SkeletonCards } from '../../components/primitives';
import { CommitList } from './CommitList';
import { WsRepoBar } from './WsRepoBar';
import { useAgentVersions } from './useAgentVersions';

interface AgentVersionsProps { botId: string; api: AgentHistoryApi; connected: boolean; isAdmin: boolean }

export function AgentVersions({ botId, api, connected, isAdmin }: AgentVersionsProps) {
  const v = useAgentVersions(botId, api, connected, isAdmin);
  const now = Date.now();
  return (
    <div className="flex flex-col gap-4">
      <WsRepoBar botId={botId} api={api} isAdmin={isAdmin} now={now} />
      {!v.commits ? <SkeletonCards /> : !v.commits.length ? (
        <EmptyState size="sm" icon="clock" title="Nenhuma versão ainda" description="Salvou um arquivo do workspace, vira commit aqui." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <CommitList commits={v.commits} selected={v.selected} onSelect={v.select} now={now} />
          <div className="flex min-w-0 flex-col gap-3">
            {v.diff?.status === 'error' && <p className="text-[13px] text-red-300">{v.diff.error}</p>}
            {v.diff?.status !== 'ok' ? v.diff?.status !== 'error' && <SkeletonCards /> : v.diff.files.map((f) => (
              <section key={f.path} className="rounded-md border border-neutral-800">
                <header className="flex items-center justify-between gap-2 px-3 pt-2">
                  <code className="truncate text-[12px] text-neutral-300">{f.path}</code>
                  {isAdmin && <Button size="xs" variant="outline" onClick={() => v.restore(f.path)} disabled={!connected}>Restaurar</Button>}
                </header>
                <DiffView diff={f} />
              </section>
            ))}
            {api.wsError && <p role="alert" className="text-[13px] text-red-300">{api.wsError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
