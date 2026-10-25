import { Button, Drawer, Icon } from '../components/primitives';
import type { CustomSaveGate } from '../cockpit/agents-view';
import type { AgentsApi } from '../cockpit/useAgents';
import type { TermApi } from '../cockpit/useTerminals';
import { AgentCustomForm } from './AgentCustomForm';
import { AgentCustomOutcome } from './AgentCustomOutcome';
import { AgentTerminal } from './AgentTerminal';
import { useAgentCustomForm } from './useAgentCustomForm';

interface AgentCustomSheetProps {
  agents: AgentsApi;
  gate: CustomSaveGate;
  term: TermApi;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function AgentCustomSheet({ agents, gate, term, onClose, onSaved }: AgentCustomSheetProps) {
  const f = useAgentCustomForm({ agents, gate, term, onSaved });
  return (
    <Drawer open side="right" width="w-full sm:max-w-md" title="Adicionar agente ACP" onClose={onClose}>
      <div className="flex flex-col gap-4 p-4">
        <p className="text-[12.5px] leading-relaxed text-neutral-400">Qualquer CLI que fale ACP vira um modelo no seletor. Eu testo antes de salvar.</p>
        {!gate.allowed && (
          <p role="note" className="flex gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-[12px] leading-relaxed text-neutral-300">
            <Icon name="shield" size={13} className="mt-0.5 shrink-0 text-neutral-500" />
            {gate.reason}
          </p>
        )}
        <AgentCustomForm f={f} locked={!gate.allowed} />
        <AgentTerminal api={f.terminal} term={term} name={f.name.trim() || 'agente novo'} />
        <AgentCustomOutcome outcome={f.outcome} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="md" icon="play" loading={f.busy === 'probe'} disabled={!f.canAct} onClick={f.probe}>Testar antes de salvar</Button>
          <Button variant="primary" size="md" icon="check" loading={f.busy === 'save'} disabled={!f.canAct} onClick={f.save}>Salvar</Button>
        </div>
      </div>
    </Drawer>
  );
}
