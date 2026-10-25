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
  const { item, status } = card;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {item ? (
        <Button variant={status === 'ready' ? 'secondary' : 'primary'} size="md" icon="play" loading={testing} onClick={onTest}>
          {status === 'ready' ? 'Testar de novo' : 'Testar'}
        </Button>
      ) : (
        <Button variant="primary" size="md" icon="plus" onClick={onConnect}>Conectar</Button>
      )}
      {testing && <span aria-live="polite" className="agent-phrase text-[12px] text-neutral-400">{phrase}</span>}
      {item && <Button variant="danger" size="sm" icon="trash" className="ml-auto" onClick={onRemove}>Remover</Button>}
    </div>
  );
}
