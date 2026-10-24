import { useState } from 'react';
import { Badge, Button } from '../components/primitives';
import type { AgentView } from '../../shared/agents';
import { STATUS_LABEL, STATUS_TONE } from '../cockpit/agents-view';
import { AdminConfirm } from './AdminConfirm';

interface AgentCustomRowProps {
  item: AgentView;
  testing: boolean;
  onTest: (id: string) => void;
  onRemove: (id: string) => void;
}

export function AgentCustomRow({ item, testing, onTest, onRemove }: AgentCustomRowProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <span className="text-[13px] font-medium text-neutral-200">{item.name}</span>
      <code className="min-w-0 truncate font-mono text-[11px] text-neutral-500">{[item.command, ...item.args].join(' ')}</code>
      <Badge tone={STATUS_TONE[item.status]} dot>{STATUS_LABEL[item.status]}</Badge>
      <span className="ml-auto flex gap-2">
        <Button variant="secondary" size="sm" icon="play" loading={testing} onClick={() => onTest(item.id)}>Testar</Button>
        <Button variant="ghost" size="sm" icon="trash" onClick={() => setConfirming(true)}>Remover</Button>
      </span>
      {confirming && (
        <AdminConfirm
          heading="Remover agente?"
          cta="Remover"
          body={<>{item.name} sai do seletor de modelo.</>}
          onConfirm={() => { onRemove(item.id); setConfirming(false); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
