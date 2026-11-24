import type { BotFile, Cron, ModelInfo, TeamBot, TeamBotInput } from '../../../shared/protocol';
import type { BotFileData } from '../../cockpit/useBotFiles';
import type { BotComputerState } from '../../cockpit/useBotComputer';
import type { TermApi } from '../../cockpit/useTerminals';
import type { ChatPanelProps } from '../../components/chat/chat-panel-props';
import type { BotView } from './team-view';
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

export interface BotComputerApi {
  botComputers: Record<string, BotComputerState>;
  onBotComputerGet: (botId: string) => void;
}

// The agent surface: an agent's thread in the chat's center, its profile beside it.
export interface EquipeProps extends CronApi, TeamTrafficApi, BotFilesApi, BotComputerApi {
  view: BotView;
  views?: BotView[];
  term: TermApi;
  connected: boolean;
  isMobile: boolean;
  // Non-admin: every bot is locked (the server coerces it anyway), so the form hides profile and mode.
  isAdmin: boolean;
  bots: TeamBot[];
  models: ModelInfo[];
  onTeamSave: (bot: TeamBotInput) => void;
  onTeamDelete: (id: string) => void;
  chatProps: ChatPanelProps;
  profileOpen: boolean;
  onToggleProfile: () => void;
  onCloseProfile: () => void;
  onEdit: () => void;
}
