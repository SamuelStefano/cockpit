import { useCallback } from 'react';
import { loginCommand } from '../../shared/mcps';
import type { TermApi } from '../cockpit/useTerminals';
import { toast } from '../components/primitives/toast-bus';
import { useAgentTerminal } from './useAgentTerminal';

export const MCP_LOGIN_TERM_ID = 'mcp-login';

// `claude mcp login` needs a real TTY, so the command is typed into a Deck
// terminal the person can see and paste the callback URL into.
export function useMcpLogin(term: TermApi, refresh: () => void) {
  const terminal = useAgentTerminal(term, MCP_LOGIN_TERM_ID, refresh);
  const login = useCallback((name: string) => {
    const cmd = loginCommand(name);
    if (!cmd) { toast('Nome de MCP inválido para o login.', { tone: 'error' }); return; }
    terminal.run('login', cmd);
  }, [terminal]);
  return { terminal, login };
}
