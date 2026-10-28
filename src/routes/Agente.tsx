import { useEffect, useState } from 'react';
import type { ModelInfo, SkillMeta, TeamBot, TeamBotInput } from '../../shared/protocol';
import { EmptyState, SkeletonCards, Tabs, toast, type TabItem } from '../components/primitives';
import type { TermApi } from '../cockpit/useTerminals';
import type { AgentBuildRequest, AgentBuildResult } from '../cockpit/useTeam';
import type { AgentTab } from '../useRoute';
import { BotComputer } from './equipe/BotComputer';
import { BotFiles } from './equipe/BotFiles';
import { BotRoutines } from './equipe/BotRoutines';
import { BotComputerProvider } from './equipe/computer-context';
import type { BotComputerApi, BotFilesApi, CronApi } from './equipe/equipe-props';
import type { BotView } from './equipe/team-view';
import { useRotinas } from './equipe/rotinas/useRotinas';
import { AgentForm } from './agente/AgentForm';
import { AgentHeader } from './agente/AgentHeader';
import { AgentList } from './agente/AgentList';

export interface AgentePageApi extends CronApi, BotFilesApi, BotComputerApi {
  bots: TeamBot[];
  models: ModelInfo[];
  teamLoaded: boolean;
  skills?: SkillMeta[];
  onSkillList?: () => void;
  term: TermApi;
  onTeamSave: (bot: TeamBotInput) => void;
  onTeamDelete: (id: string) => void;
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
  const { onSkillList } = api;
  useEffect(() => { if (connected && agentId) onSkillList?.(); }, [connected, agentId, onSkillList]);
  const shell = (children: React.ReactNode) => (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-240 px-4 pb-8 pt-6 max-lg:pt-2 sm:px-8">{children}</div>
    </div>
  );
  if (!agentId) return shell(<AgentList views={views} bots={api.bots} onOpen={(id) => onTab(id, 'perfil')} onNew={() => onTab('novo', 'perfil')} />);
  if (agentId === 'novo') {
    return shell(
      <div className="max-w-95">
        <h1 className="pb-5 text-[22px] max-lg:hidden font-semibold tracking-[-0.02em] text-neutral-100">Novo agente</h1>
        <AgentForm bot={null} bots={api.bots} models={api.models} skills={api.skills} locked={!isAdmin} onSave={api.onTeamSave}
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
    { id: 'computador', label: 'Computador' },
  ];
  const body = (
    <>
      <AgentHeader bot={bot} bots={api.bots} state={state} onChat={() => onChat(bot.id)} onBack={onList} />
      <Tabs items={tabs} active={tab} onChange={(t) => onTab(bot.id, t)} className="mb-6 max-lg:mb-3" />
      {tab === 'perfil' && (
        <div className="max-w-95">
          <AgentForm key={`${bot.id}:${bot.updatedAt}:${formKey}`} bot={bot} bots={api.bots} models={api.models} skills={api.skills} locked={!isAdmin}
            agentBuild={api.agentBuild} onAgentBuild={api.onAgentBuild} onSave={api.onTeamSave} onSaved={() => toast('Agente salvo')} onCancel={() => setFormKey((k) => k + 1)}
            onDelete={(id) => { api.onTeamDelete(id); onList(); }} />
        </div>
      )}
      {tab === 'rotinas' && <RoutinesTab botId={bot.id} bots={api.bots} api={api} connected={connected} onChat={onChat} />}
      {tab === 'arquivos' && <BotFiles botId={bot.id} api={api} connected={connected} />}
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
