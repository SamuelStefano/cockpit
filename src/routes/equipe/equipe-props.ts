import type { Cron, ModelInfo, TeamBot, TeamBotInput } from '../../../shared/protocol';
import type { ChatPanelProps } from '../../components/chat/chat-panel-props';
import type { Session } from '../../data/types';
import type { Phase } from '../../components/chat/useChatPanel';
import type { TeamMessage } from '../../../shared/team-messages';
import type { TeamMessagesQuery } from '../../cockpit/useTeam';

export interface CronApi {
  crons: Cron[];
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
}

export interface TeamTrafficApi {
  teamMessages: TeamMessage[];
  teamPaused: boolean;
  onTeamMessagesGet: (q?: TeamMessagesQuery) => void;
  onTeamPauseSet: (paused: boolean) => void;
}

export interface EquipeProps extends CronApi, TeamTrafficApi {
  connected: boolean;
  isMobile: boolean;
  bots: TeamBot[];
  teamLoaded: boolean;
  onTeamGet: () => void;
  onTeamSave: (bot: TeamBotInput) => void;
  onTeamDelete: (id: string) => void;
  onOpenBot: (botId: string, sessionId: string | undefined, title: string) => void;
  sessions: Session[];
  running: Set<string>;
  activeId: string;
  phase: Phase;
  interrupted: Record<string, string>;
  runStart: Record<string, number>;
  models: ModelInfo[];
  chatProps: ChatPanelProps;
}

export type EquipePane = 'roster' | 'thread' | 'profile';
export type BotFormTarget = { mode: 'new' } | { mode: 'edit'; bot: TeamBot } | null;
