import { Collapsible } from '../Collapsible';
import { AdminAgents } from '../AdminAgents';
import { AdminModels } from '../AdminModels';
import { AdminMcps } from '../AdminMcps';
import { MCP_LOGIN_EVENT } from '../mcp-login-request';
import type { AgentsApi } from '../../cockpit/useAgents';
import type { TermApi } from '../../cockpit/useTerminals';
import type { ModelInfo } from '../../../shared/protocol';

export interface ManageProps {
  agents: AgentsApi;
  onMcpsGet: () => void;
  term: TermApi;
  models: ModelInfo[];
  isRoot: boolean;
  onOpenAgentChat: (model: string) => void;
}

export function ManageProviders({ agents, term, models, isRoot, onOpenAgentChat }: ManageProps) {
  return (
    <Collapsible title="Gerenciar provedores e modelos">
      <AdminAgents agents={agents} term={term} isRoot={isRoot} onOpenChat={onOpenAgentChat} />
      <AdminModels models={models} />
    </Collapsible>
  );
}

export function ManageTools({ onMcpsGet, term }: ManageProps) {
  return (
    <Collapsible title="Gerenciar ferramentas" openOn={MCP_LOGIN_EVENT}>
      <AdminMcps onRefresh={onMcpsGet} term={term} />
    </Collapsible>
  );
}
