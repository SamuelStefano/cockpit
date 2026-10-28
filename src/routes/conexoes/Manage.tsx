import { Collapsible } from '../Collapsible';
import { AdminAgents } from '../AdminAgents';
import { AdminModels } from '../AdminModels';
import { AdminDflMcps } from '../AdminDflMcps';
import { DFL_LOGIN_EVENT } from '../dfl-login-request';
import type { AgentsApi } from '../../cockpit/useAgents';
import type { DflMcps } from '../../cockpit/useDflMcps';
import type { TermApi } from '../../cockpit/useTerminals';
import type { ModelInfo } from '../../../shared/protocol';

export interface ManageProps {
  agents: AgentsApi;
  dflMcps: Pick<DflMcps, 'dflMcps' | 'dflMcpsBusy' | 'onDflMcpsGet' | 'onDflMcpsAdd'>;
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

export function ManageTools({ dflMcps, term }: ManageProps) {
  return (
    <Collapsible title="Gerenciar ferramentas" openOn={DFL_LOGIN_EVENT}>
      <AdminDflMcps api={dflMcps} term={term} />
    </Collapsible>
  );
}
