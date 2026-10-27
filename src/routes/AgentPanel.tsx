import { Icon } from '../components/primitives';
import type { AgentCardModel } from '../cockpit/agents-view';
import type { TermApi } from '../cockpit/useTerminals';
import { AdminConfirm } from './AdminConfirm';
import { AgentActions } from './AgentActions';
import { AgentCallout } from './AgentCallout';
import { AgentStepper } from './AgentStepper';
import { AgentSuccess } from './AgentSuccess';
import { AgentTerminal } from './AgentTerminal';
import { useAgentPanel } from './useAgentPanel';
import './agents.css';

interface AgentPanelProps {
  card: AgentCardModel;
  term: TermApi;
  testing: boolean;
  celebrating: boolean;
  phrase: string;
  message?: string;
  onConnect: (preset: string) => void;
  onTest: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenChat: (id: string) => void;
}

export function AgentPanel({ card, term, testing, celebrating, phrase, message, onConnect, onTest, onRemove, onOpenChat }: AgentPanelProps) {
  const { preset, item, status } = card;
  const p = useAgentPanel(card, { term, onConnect, onTest });
  return (
    <>
      <div className="agent-panel">
        <div>
          <div className="flex flex-col gap-3.5 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
            <p className="text-[13px] leading-relaxed text-neutral-400">
              {preset.blurb}
              {preset.docs && (
                <a href={preset.docs} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-1 text-neutral-500 hover:text-orange-300">
                  Docs <Icon name="external" size={11} />
                </a>
              )}
            </p>
            {p.ready && item && <AgentSuccess name={preset.name} celebrating={celebrating} onOpenChat={() => onOpenChat(item.id)} />}
            <AgentStepper
              steps={preset.steps} done={p.done} current={p.current} running={p.terminal.running?.kind ?? null}
              testing={testing} onRun={p.run} onTest={p.test}
            />
            {!p.ready && item && !testing && !p.terminal.running && <AgentCallout status={status} message={message} />}
            <AgentTerminal api={p.terminal} term={term} name={preset.name} />
            <AgentActions
              card={card} testing={testing} phrase={phrase}
              onConnect={() => onConnect(preset.id)} onTest={p.test} onRemove={() => p.setConfirming(true)}
            />
          </div>
        </div>
      </div>
      {p.confirming && item && (
        <AdminConfirm
          heading="Remover agente?"
          cta="Remover"
          body={<>{preset.name} sai do seletor de modelo. Chats fixados nele deixam de responder até você adicionar de novo.</>}
          onConfirm={() => { onRemove(item.id); p.setConfirming(false); }}
          onCancel={() => p.setConfirming(false)}
        />
      )}
    </>
  );
}
