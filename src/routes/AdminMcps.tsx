import { useEffect } from 'react';
import type { TermApi } from '../cockpit/useTerminals';
import { AgentTerminal } from './AgentTerminal';
import { useMcpLogin } from './useMcpLogin';
import { takeMcpLogin } from './mcp-login-request';

interface AdminMcpsProps {
  onRefresh: () => void;
  term: TermApi;
}

export function AdminMcps({ onRefresh, term }: AdminMcpsProps) {
  const { terminal, login } = useMcpLogin(term, onRefresh);
  useEffect(() => {
    const asked = takeMcpLogin();
    if (asked) login(asked);
  }, [login]);

  return (
    <div className="mb-5 flex flex-col gap-3">
      <p className="text-[13px] text-neutral-500">
        Servidores MCP são adicionados no Claude Code (<code className="font-mono text-neutral-400">claude mcp add …</code>). Quando um pedir login, clique em Entrar na lista:
        abra o link no seu navegador, entre, e quando a página falhar copie a URL inteira (localhost…) e cole no terminal.
      </p>
      <AgentTerminal api={terminal} term={term} name="Ferramentas" />
    </div>
  );
}
