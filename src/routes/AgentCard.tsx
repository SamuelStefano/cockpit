import { useState } from 'react';
import { Badge, Button, Icon } from '../components/primitives';
import { STATUS_LABEL, STATUS_TONE, type AgentCardModel } from '../cockpit/agents-view';
import type { AgentTestResult } from '../cockpit/useAgents';
import { AdminConfirm } from './AdminConfirm';
import { AgentSteps } from './AgentSteps';

interface AgentCardProps {
  card: AgentCardModel;
  testing: boolean;
  lastTest: AgentTestResult | null;
  onConnect: (preset: string) => void;
  onTest: (id: string) => void;
  onRemove: (id: string) => void;
}

export function AgentCard({ card, testing, lastTest, onConnect, onTest, onRemove }: AgentCardProps) {
  const { preset, item, status } = card;
  const [confirming, setConfirming] = useState(false);
  const message = lastTest?.id === preset.id ? lastTest.message : item?.detail;
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-semibold text-neutral-100">{preset.name}</h3>
        <span className="text-[11px] text-neutral-500">{preset.vendor}</span>
        <Badge tone={preset.source === 'open' ? 'purple' : 'neutral'}>{preset.source === 'open' ? 'código aberto' : 'código fechado'}</Badge>
        <Badge tone={STATUS_TONE[status]} dot>{STATUS_LABEL[status]}</Badge>
        <a href={preset.docs} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-neutral-500 hover:text-orange-300">
          Documentação <Icon name="external" size={11} />
        </a>
      </header>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-400">{preset.blurb}</p>
      <AgentSteps steps={preset.steps} activeStep={card.activeStep} />
      {message && <p className="mt-2 wrap-anywhere text-[11.5px] text-neutral-500">{message}</p>}
      {status === 'ready' && (
        <p className="mt-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-[12px] text-green-300">
          Abra um chat e escolha <strong>{preset.name} · agente</strong> no seletor de modelo.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {item ? (
          <>
            <Button variant="primary" size="sm" icon="play" loading={testing} onClick={() => onTest(item.id)}>Testar</Button>
            <Button variant="ghost" size="sm" icon="trash" onClick={() => setConfirming(true)}>Remover</Button>
          </>
        ) : (
          <Button variant="primary" size="sm" icon="plus" onClick={() => onConnect(preset.id)}>Conectar</Button>
        )}
      </div>
      {confirming && (
        <AdminConfirm
          heading="Remover agente?"
          cta="Remover"
          body={<>{preset.name} sai do seletor de modelo. Chats fixados nele deixam de responder até você conectar de novo.</>}
          onConfirm={() => { if (item) onRemove(item.id); setConfirming(false); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}
