import { useCallback } from 'react';
import { loginCommand, type DflMcpHostState } from '../../shared/dfl-mcps';
import type { TermApi } from '../cockpit/useTerminals';
import { toast } from '../components/primitives/toast-bus';
import { useAgentTerminal } from './useAgentTerminal';

export const MCP_LOGIN_TERM_ID = 'mcp-dfl';

// `claude mcp login` needs a real TTY, so the command is typed into a Deck
// terminal the person can see and paste the callback URL into.
export function useDflMcpLogin(term: TermApi, refresh: () => void) {
  const terminal = useAgentTerminal(term, MCP_LOGIN_TERM_ID, refresh);
  const login = useCallback((host: DflMcpHostState) => {
    const cmd = loginCommand(host.name);
    if (!cmd) { toast('Nome de MCP inválido para o login.', { tone: 'error' }); return; }
    terminal.run('login', cmd);
  }, [terminal]);
  return { terminal, login };
}
