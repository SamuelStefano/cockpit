import { Suspense } from 'react';
import type { ChatPanelProps } from '../components/chat/chat-panel-props';
import type { useCockpit } from '../useCockpit';
import type { AgentNav } from './useAgentNav';
import type { BotView } from '../routes/equipe/team-view';
import { Equipe } from './lazyRoutes';

interface AgentCenterProps {
  view: BotView;
  agent: AgentNav;
  cockpit: ReturnType<typeof useCockpit>;
  chatProps: ChatPanelProps;
  connected: boolean;
  isMobile: boolean;
  isAdmin: boolean;
}

// The open agent's thread, in the slot the plain chat uses. Its own Suspense keeps
// the terminals beside it mounted while the chunk loads.
export function AgentCenter({ view, agent, cockpit: c, chatProps, connected, isMobile, isAdmin }: AgentCenterProps) {
  return (
    <Suspense fallback={null}>
      <Equipe
        key={view.bot.id} view={view} connected={connected} isMobile={isMobile} isAdmin={isAdmin}
        bots={c.bots} models={c.models} onTeamSave={c.onTeamSave} onTeamDelete={c.onTeamDelete} chatProps={chatProps}
        crons={c.crons} onCronsGet={c.onCronsGet} onCronSave={c.onCronSave} onCronDelete={c.onCronDelete} onCronRun={c.onCronRun}
        teamMessages={c.teamMessages} teamPaused={c.teamPaused} onTeamMessagesGet={c.onTeamMessagesGet} onTeamPauseSet={c.onTeamPauseSet}
        botFiles={c.botFiles} botFileData={c.botFileData} onBotFilesGet={c.onBotFilesGet} onBotFileGet={c.onBotFileGet}
        botComputers={c.botComputers} onBotComputerGet={c.onBotComputerGet} term={c.term}
        profileOpen={agent.profileOpen} onToggleProfile={agent.toggleProfile} onCloseProfile={agent.closeProfile} onEdit={agent.openEdit}
      />
    </Suspense>
  );
}
