import { Button } from '../components/primitives';
import type { AgentCardModel } from '../cockpit/agents-view';

interface AgentActionsProps {
  card: AgentCardModel;
  testing: boolean;
  phrase: string;
  onConnect: () => void;
  onTest: () => void;
  onRemove: () => void;
}

export function AgentActions({ card, testing, phrase, onConnect, onTest, onRemove }: AgentActionsProps) {
  const { item, status, preset } = card;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!item && <Button variant="primary" size="md" icon="plus" onClick={onConnect}>Adicionar {preset.name}</Button>}
      {item && status === 'ready' && <Button variant="secondary" size="sm" icon="play" loading={testing} onClick={onTest}>Testar de novo</Button>}
      {item && status !== 'ready' && card.activeStep < 2 && <Button variant="ghost" size="sm" icon="play" loading={testing} onClick={onTest}>Já fiz isso, testar</Button>}
      {testing && <span aria-live="polite" className="agent-phrase text-[12px] text-neutral-400">{phrase}</span>}
      {item && <Button variant="ghost" size="sm" icon="trash" className="ml-auto" onClick={onRemove}>Remover</Button>}
    </div>
  );
}
