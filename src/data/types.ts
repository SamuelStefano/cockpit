// Tipos de chat = fonte única em shared/protocol (re-export p/ os componentes).
// Aqui ficam só os tipos de sessão/terminal do lado do cliente.
export type {
  ToolCall, ToolQuestion, ToolQuestionOption, ToolTodo, TextBlock, CodeBlock, ToolBlock, Block,
  UserMessage, AssistantMessage, CompactMessage, PrLink, Message,
} from '../../shared/protocol';

export interface Session {
  id: string;
  title: string;
  relative: string;
  snippet: string;
  summary?: string; // resumo IA do que a sessão fez (fica acima do snippet quando existe)
  mtime: number;
  hasTerminal: boolean;
  active: boolean;
  waiting?: boolean; // último turno parou numa pergunta e espera resposta sua
}

// Terminal real = PTY/tmux no backend; aqui só o metadado de aba.
export interface Terminal {
  id: string;
  name: string;
}

export type ConnState = 'connected' | 'reconnecting' | 'down';

export const TERMINALS_SEED: Terminal[] = [
  { id: 'main', name: 'shell' },
];
