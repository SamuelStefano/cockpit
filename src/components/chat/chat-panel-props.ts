import type { Session, Message, ToolTodo } from '../../data/types';
import type { PermMode, Effort, ModelInfo, TurnStats, Caps, SkillMeta, BgAgent, ParkedView } from '../../../shared/protocol';
import type { Attachment, AttachmentPreview } from '../../useCockpit';
import type { Phase } from './useChatPanel';

export interface ChatPanelProps {
  session: Session | null;
  messages: Message[];
  phase: Phase;
  // Escrita externa (turno do terminal) na sessão ativa há <5s — acende a
  // estrelinha mesmo sem run do app (paridade com acompanhar pelo terminal).
  terminalBusy?: boolean;
  // Estado corrente da lista de tarefas (arquivo inteiro, via frame history) —
  // fallback do tray quando a janela visível não tem snapshot (pós-compact).
  sessionTodos?: ToolTodo[];
  // Tópicos de continuação pós-turno (chips estilo ChatGPT) + dispensa.
  followups?: string[];
  onDismissFollowups?: () => void;
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string, modeOverride?: PermMode) => void;
  onPrompt: (text: string) => void;
  onStop: () => void;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps: Caps | null;
  claudeReady?: boolean;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  effort: Effort;
  setEffort: (e: Effort) => void;
  skills: SkillMeta[];
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
  slashCommands: string[];
  contextTokens: number;
  liveTurnTokens?: number;
  turnStartedAt?: number;
  bgAgents?: BgAgent[];
  lastTurn?: TurnStats;
  onNew: () => void;
  onHandoff?: (sessionId: string) => void;
  handoffBusy?: boolean;
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  attPreview?: AttachmentPreview | null;
  onAttOpen?: (path: string, name: string) => void;
  onAttClose?: () => void;
  attThumbs?: Record<string, string>;
  onAttThumb?: (path: string) => void;
  onEditUser?: (id: string, text: string) => void;
  onQuote?: (text: string) => void;
  onRename?: (id: string, title: string) => void;
  onOpenFull?: (id: string) => void;
  onLoadOlder?: (id: string) => void;
  onOpenSummary?: (id: string) => void;
  truncated?: boolean;
  onShowHelp?: () => void;
  lastEnd?: string;
  focusSignal?: number;
  onTerminal?: () => void;
  terminalRunning?: boolean;
  isMobile?: boolean;
  // Teclado virtual aberto no celular: o chat enxuga tudo que não é mensagem
  // (só sobram ~150px de thread num viewport de 420).
  keyboardOpen?: boolean;
  quotaPaused?: boolean;
  quotaResetsAt?: number | null;
  queue: ParkedView[];
  queueAdd: (text: string) => void;
  queueRemove: (sessionKey: string, id: string) => void;
  queueEdit: (sessionKey: string, id: string, text: string) => void;
  queueMove: (sessionKey: string, id: string, dir: -1 | 1) => void;
  queueClear: (sessionKey: string) => void;
  queuePaused: boolean;
  queueSetPaused: (v: boolean) => void;
  queueRetry: (sessionKey: string, id: string) => void;
  queueRunBg: (sessionKey: string, id: string, model?: string) => void;
  queueRunNow: (sessionKey: string, id: string) => void;
  queueForce: (sessionKey: string) => void;
}
