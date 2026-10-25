import type { BotFile, Cron, ModelInfo, TeamBot, TeamBotInput, TeamPendingQuestion } from '../../../shared/protocol';
import type { BotFileData } from '../../cockpit/useBotFiles';
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

export interface BotFilesApi {
  botFiles: Record<string, BotFile[]>;
  botFileData: Record<string, BotFileData>;
  onBotFilesGet: (botId: string) => void;
  onBotFileGet: (botId: string, path: string, force?: boolean) => void;
}

export interface EquipeProps extends CronApi, TeamTrafficApi, BotFilesApi {
  pendingQuestions: TeamPendingQuestion[];
  connected: boolean;
  isMobile: boolean;
  // Non-admin: every bot is locked (the server coerces it anyway), so the form hides profile and mode.
  isAdmin: boolean;
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
