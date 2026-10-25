import { useState } from 'react';
import { Icon } from '../components/primitives';
import { progressFor, type AgentCardModel } from '../cockpit/agents-view';
import { AdminConfirm } from './AdminConfirm';
import { AgentActions } from './AgentActions';
import { AgentCallout } from './AgentCallout';
import { AgentStepper } from './AgentStepper';
import { AgentSuccess } from './AgentSuccess';
import './agents.css';

interface AgentPanelProps {
  card: AgentCardModel;
  testing: boolean;
  celebrating: boolean;
  phrase: string;
  message?: string;
  onConnect: (preset: string) => void;
  onTest: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenChat: (id: string) => void;
}

export function AgentPanel({ card, testing, celebrating, phrase, message, onConnect, onTest, onRemove, onOpenChat }: AgentPanelProps) {
  const { preset, item, status } = card;
  const [confirming, setConfirming] = useState(false);
  const done = progressFor(status, !!item);
  const ready = status === 'ready' && !!item;
  return (
    <>
      <div className="agent-panel">
      <div>
        <div className="flex flex-col gap-3.5 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
          <p className="text-[12.5px] leading-relaxed text-neutral-400">{preset.blurb}</p>
          {ready && item && <AgentSuccess name={preset.name} celebrating={celebrating} onOpenChat={() => onOpenChat(item.id)} />}
          {preset.steps.length > 0 && <AgentStepper steps={preset.steps} done={done} current={ready ? null : item ? card.activeStep : 0} />}
          {!ready && item && !testing && <AgentCallout status={status} message={message} />}
          <AgentActions
            card={card} testing={testing} phrase={phrase}
            onConnect={() => onConnect(preset.id)} onTest={() => item && onTest(item.id)} onRemove={() => setConfirming(true)}
          />
          {preset.docs && (
            <a href={preset.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-[11.5px] text-neutral-500 hover:text-orange-300">
              Documentação <Icon name="external" size={11} />
            </a>
          )}
        </div>
      </div>
      </div>
      {confirming && item && (
        <AdminConfirm
          heading="Remover agente?"
          cta="Remover"
          body={<>{preset.name} sai do seletor de modelo. Chats fixados nele deixam de responder até você conectar de novo.</>}
          onConfirm={() => { onRemove(item.id); setConfirming(false); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
