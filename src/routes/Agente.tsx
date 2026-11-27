import { useEffect, useState } from 'react';
import type { ModelInfo, SkillMeta, TeamBot, TeamBotInput } from '../../shared/protocol';
import { EmptyState, SkeletonCards, Tabs, toast, type TabItem } from '../components/primitives';
import type { TermApi } from '../cockpit/useTerminals';
import type { AgentBuildRequest, AgentBuildResult } from '../cockpit/useTeam';
import type { AgentTab } from '../useRoute';
import { BotComputer } from './equipe/BotComputer';
import { BotRoutines } from './equipe/BotRoutines';
import { BotComputerProvider } from './equipe/computer-context';
import type { BotComputerApi, BotFilesApi, CronApi } from './equipe/equipe-props';
import type { BotView } from './equipe/team-view';
import { useRotinas } from './equipe/rotinas/useRotinas';
import { AgentForm } from './agente/AgentForm';
import { AgentHeader } from './agente/AgentHeader';
import { AgentWorkspace } from './agente/AgentWorkspace';
import { AgentVersions } from './agente/AgentVersions';
import { WsRepoBar } from './agente/WsRepoBar';
import type { AgentHistoryApi } from '../cockpit/useAgentHistory';

export interface AgentePageApi extends CronApi, BotFilesApi, BotComputerApi, AgentHistoryApi {
  bots: TeamBot[];
  models: ModelInfo[];
  teamLoaded: boolean;
  skills?: SkillMeta[];
  onSkillList?: () => void;
  term: TermApi;
  onTeamSave: (bot: TeamBotInput) => void;
  onTeamDelete: (id: string) => void;
  onTeamSyncSource?: (id: string) => void;
  agentBuild?: AgentBuildResult | null;
  onAgentBuild?: (req: AgentBuildRequest) => boolean;
}

interface AgenteProps {
  agentId: string;
  tab: AgentTab;
  views: BotView[];
  api: AgentePageApi;
  connected: boolean;
  isAdmin: boolean;
  isMobile: boolean;
  onTab: (id: string, tab: AgentTab) => void;
  onList: () => void;
  onChat: (id: string) => void;
}

function RoutinesTab({ botId, bots, api, connected, onChat }: { botId: string; bots: TeamBot[]; api: CronApi; connected: boolean; onChat: (id: string) => void }) {
  const r = useRotinas({ ...api, bots, botId, connected });
  return <BotRoutines botId={botId} r={r} onChat={onChat} />;
}

export function Agente({ agentId, tab, views, api, connected, isAdmin, isMobile, onTab, onList, onChat }: AgenteProps) {
  const [formKey, setFormKey] = useState(0);
  const { onSkillList, onWsSync, onWsLogGet } = api;
  useEffect(() => { if (connected && agentId) onSkillList?.(); }, [connected, agentId, onSkillList]);
  const wsRepo = api.wsStatus?.repo;
  useEffect(() => { if (connected && agentId && agentId !== 'novo') onWsLogGet(agentId); }, [connected, agentId, onWsLogGet]);
  useEffect(() => { if (connected && isAdmin && wsRepo && agentId !== 'novo') onWsSync(); }, [connected, isAdmin, wsRepo, agentId, onWsSync]);
  const shell = (children: React.ReactNode) => (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-240 px-4 pb-8 pt-6 max-lg:pt-2 sm:px-8">{children}</div>
    </div>
  );
  // The draft is built once, on mount: before the team list and the role arrive it
  // would take "first agent" (primary) and the non-admin lock (restricted profile).
  if (agentId === 'novo') {
    if (!api.teamLoaded) return shell(<SkeletonCards />);
    return shell(
      <div className="max-w-170">
        <div className="flex flex-col gap-1 pb-5 max-lg:hidden"><h1 className="text-[22px] font-semibold tracking-[-0.02em] text-neutral-100">Novo agente</h1><p className="text-[13px] text-(--text-muted)">Quem ele é e o que pode fazer.</p></div>
        <AgentForm key={String(isAdmin)} bot={null} bots={api.bots} models={api.models} skills={api.skills} locked={!isAdmin} onSave={api.onTeamSave}
          agentBuild={api.agentBuild} onAgentBuild={api.onAgentBuild} onSaved={(id) => onTab(id, 'perfil')} onCancel={onList} />
      </div>,
    );
  }
  const view = views.find((v) => v.bot.id === agentId);
  if (!view) {
    return shell(api.teamLoaded
      ? <EmptyState size="sm" icon="users" title="Agente não encontrado" description="Ele pode ter sido removido." />
      : <SkeletonCards />);
  }
  const { bot, state } = view;
  const tabs: TabItem<AgentTab>[] = [
    { id: 'perfil', label: 'Perfil' },
    { id: 'rotinas', label: 'Rotinas', count: api.crons.filter((c) => c.botId === bot.id).length },
    { id: 'arquivos', label: 'Arquivos', count: api.botFiles[bot.id]?.length },
    { id: 'versoes', label: 'Versões' },
    { id: 'computador', label: 'Computador' },
  ];
  const body = (
    <>
      <AgentHeader bot={bot} bots={api.bots} state={state} onChat={() => onChat(bot.id)} onBack={onList} />
      <Tabs items={tabs} active={tab} onChange={(t) => onTab(bot.id, t)} className="mb-6 max-lg:mb-3" />
      {tab === 'perfil' && (
        <div className="max-w-170">
          <AgentForm key={`${bot.id}:${bot.updatedAt}:${formKey}:${isAdmin}`} bot={bot} bots={api.bots} models={api.models} skills={api.skills} locked={!isAdmin}
            agentBuild={api.agentBuild} onAgentBuild={api.onAgentBuild} onSave={api.onTeamSave} onSaved={() => toast('Agente salvo')} onCancel={() => setFormKey((k) => k + 1)}
            onDelete={(id) => { api.onTeamDelete(id); onList(); }} onSyncSource={api.onTeamSyncSource} />
          <div className="mt-6 border-t border-neutral-800 pt-4"><WsRepoBar botId={bot.id} api={api} isAdmin={isAdmin} now={Date.now()} /></div>
        </div>
      )}
      {tab === 'rotinas' && <RoutinesTab botId={bot.id} bots={api.bots} api={api} connected={connected} onChat={onChat} />}
      {tab === 'arquivos' && <AgentWorkspace botId={bot.id} api={api} connected={connected} canEdit />}
      {tab === 'versoes' && <AgentVersions botId={bot.id} api={api} connected={connected} isAdmin={isAdmin} />}
      {tab === 'computador' && <BotComputer bot={bot} state={state} />}
    </>
  );
  if (tab !== 'computador') return shell(body);
  return (
    <BotComputerProvider bot={bot} state={state} api={api} term={api.term} connected={connected} isAdmin={isAdmin} isMobile={isMobile}>
      {shell(body)}
    </BotComputerProvider>
  );
}
