// Tipos de chat = fonte única em shared/protocol (re-export p/ os componentes).
// Aqui ficam só os tipos/seed de TERMINAL (Fase posterior ainda em mock).
export type {
  ToolCall, TextBlock, CodeBlock, ToolBlock, Block,
  UserMessage, AssistantMessage, Message,
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
