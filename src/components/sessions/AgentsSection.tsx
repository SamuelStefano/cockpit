import { memo, useMemo } from 'react';
import type { BotView } from '../../routes/equipe/team-view';
import { Button, Icon } from '../primitives';
import { tokens } from '../primitives/tokens';
import { orderTeam } from '../team/team-order';
import { TeamRoster } from '../team/TeamRoster';
import { useAgentFold } from './useAgentFold';

interface Props {
  views: BotView[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew?: () => void;
  // Phone drawer: rows are shorter and mascots calmer.
  compact?: boolean;
}

function AgentsSectionImpl({ views, activeId, onOpen, onNew, compact = false }: Props) {
  const entries = useMemo(() => orderTeam(views), [views]);
  const { expanded, toggleSection, visible, fold } = useAgentFold(entries, activeId);
  if (views.length === 0) return null;
  return (
    <section aria-label="Agentes" className={`${compact ? 'roster-calm ' : ''}space-y-0.5`}>
      <button
        type="button" onClick={toggleSection} aria-expanded={expanded} aria-label={`${expanded ? 'Recolher' : 'Mostrar'} agentes`}
        className={`sticky top-0 z-1 -mx-2 flex w-[calc(100%+1rem)] items-center gap-1.5 bg-neutral-950 px-4.5 pb-1 pt-4 text-left text-[12px] font-medium tracking-wide text-neutral-500 hover:text-neutral-300 ${tokens.focusRing}`}
      >
        <span>Agentes</span>
        <span className="font-normal text-neutral-600">{views.length}</span>
        <Icon name="chevronDown" size={13} className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {visible.length > 0 && (
        <TeamRoster
          entries={visible} activeId={activeId} onOpen={onOpen} phrases={false}
          rowHeight={compact ? 36 : 40} mascotSize={compact ? 24 : 28} fold={fold}
        />
      )}
      {expanded && onNew && <Button variant="ghost" size="sm" icon="plus" onClick={onNew} className="w-full justify-start">Novo agente</Button>}
    </section>
  );
}

export const AgentsSection = memo(AgentsSectionImpl);
