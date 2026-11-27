import { Button } from '../components/primitives';
import type { AgentCardModel } from '../cockpit/agents-view';

interface AgentActionsProps {
  card: AgentCardModel;
  testing: boolean;
  phrase: string;
  onConnect: () => void;
  onTest: () => void;
  onRemove: () => void;
  onVersions?: () => void;
}

export function AgentActions({ card, testing, phrase, onConnect, onTest, onRemove, onVersions }: AgentActionsProps) {
  const { item, status } = card;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!item && <Button variant="secondary" size="sm" icon="plus" onClick={onConnect}>Só adicionar (já instalei)</Button>}
      {item && status === 'ready' && <Button variant="secondary" size="sm" icon="play" loading={testing} onClick={onTest}>Testar de novo</Button>}
      {item && status !== 'ready' && card.activeStep < 2 && <Button variant="ghost" size="sm" icon="play" loading={testing} onClick={onTest}>Já fiz isso, testar</Button>}
      {testing && <span aria-live="polite" className="agent-phrase text-[13px] text-neutral-400">{phrase}</span>}
      {item && onVersions && <Button variant="ghost" size="sm" icon="clock" className="ml-auto" onClick={onVersions}>Versões</Button>}
      {item && <Button variant="ghost" size="sm" icon="trash" className={onVersions ? '' : 'ml-auto'} onClick={onRemove}>Remover</Button>}
    </div>
  );
}
