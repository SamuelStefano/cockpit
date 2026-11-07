import type { BotView } from '../../routes/equipe/team-view';
import { Button } from '../primitives';
import { orderTeam } from '../team/team-order';
import { TeamRoster } from '../team/TeamRoster';
import { SessionGroupHeader } from './SessionGroupHeader';

interface Props {
  views: BotView[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew?: () => void;
}

export function AgentsSection({ views, activeId, onOpen, onNew }: Props) {
  if (views.length === 0) return null;
  return (
    <section aria-label="Agentes" className="space-y-0.5">
      <SessionGroupHeader label="Agentes" />
      <TeamRoster entries={orderTeam(views)} activeId={activeId} onOpen={onOpen} rowHeight={40} phrases={false} />
      {onNew && <Button variant="ghost" size="sm" icon="plus" onClick={onNew} className="w-full justify-start">Novo agente</Button>}
    </section>
  );
}
