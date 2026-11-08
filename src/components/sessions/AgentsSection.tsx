import { memo, useMemo } from 'react';
import type { BotView } from '../../routes/equipe/team-view';
import { Button } from '../primitives';
import { orderTeam } from '../team/team-order';
import { TeamRoster } from '../team/TeamRoster';
import { SessionGroupHeader } from './SessionGroupHeader';
import { useAgentFold } from './useAgentFold';

interface Props {
  views: BotView[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew?: () => void;
  // Phone drawer: workers fold under their lead and rows are shorter.
  compact?: boolean;
}

function AgentsSectionImpl({ views, activeId, onOpen, onNew, compact = false }: Props) {
  const entries = useMemo(() => orderTeam(views), [views]);
  const { visible, counts, open, toggle } = useAgentFold(entries, compact);
  if (views.length === 0) return null;
  return (
    <section aria-label="Agentes" className={`${compact ? 'roster-calm ' : ''}space-y-0.5`}>
      <SessionGroupHeader label="Agentes" />
      <TeamRoster
        entries={visible} activeId={activeId} onOpen={onOpen} phrases={false}
        rowHeight={compact ? 36 : 40} mascotSize={compact ? 24 : 32} fold={counts && { counts, open, onToggle: toggle }}
      />
      {onNew && <Button variant="ghost" size="sm" icon="plus" onClick={onNew} className="w-full justify-start">Novo agente</Button>}
    </section>
  );
}

export const AgentsSection = memo(AgentsSectionImpl);
