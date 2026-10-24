import type { Cron, ModelInfo, TeamBot, TeamBotInput } from '../../../shared/protocol';
import type { ChatPanelProps } from '../../components/chat/chat-panel-props';
import type { Session } from '../../data/types';
import type { Phase } from '../../components/chat/useChatPanel';

export interface CronApi {
  crons: Cron[];
  onCronsGet: () => void;
  onCronSave: (cron: Cron) => void;
  onCronDelete: (id: string) => void;
  onCronRun: (id: string) => void;
}

export interface EquipeProps extends CronApi {
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
