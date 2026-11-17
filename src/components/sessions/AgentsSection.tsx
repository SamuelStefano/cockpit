import { memo, useMemo } from 'react';
import { groupByDepartment } from '../../../shared/departments';
import type { BotView } from '../../routes/equipe/team-view';
import { Button, Icon } from '../primitives';
import { tokens } from '../primitives/tokens';
import { orderTeam, type TeamEntry } from '../team/team-order';
import { TeamRoster } from '../team/TeamRoster';
import { DepartmentHeader } from './DepartmentHeader';
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
  const groups = useMemo(
    () => (views.some((v) => v.bot.department) ? groupByDepartment(views, (v) => v.bot.department).map((g) => ({ ...g, entries: orderTeam(g.items) })) : null),
    [views],
  );
  const entries = useMemo(() => (groups ? groups.flatMap((g) => g.entries) : orderTeam(views)), [groups, views]);
  const { expanded, toggleSection, visible, fold } = useAgentFold(entries, activeId);
  if (views.length === 0) return null;
  const roster = (list: TeamEntry[]) => (
    <TeamRoster
      entries={list} activeId={activeId} onOpen={onOpen} phrases={!compact} livePhrase={false}
      rowHeight={compact ? 36 : 40} mascotSize={compact ? 24 : 28} fold={fold}
    />
  );
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
      {visible.length > 0 && !groups && roster(visible)}
      {visible.length > 0 && groups?.map((g) => {
        const shown = visible.filter((e) => g.items.includes(e.view));
        if (shown.length === 0) return null;
        return (
          <div key={g.department?.id ?? 'none'} className="space-y-0.5">
            <DepartmentHeader department={g.department} count={g.items.length} />
            {roster(shown)}
          </div>
        );
      })}
      {expanded && onNew && <Button variant="ghost" size="sm" icon="plus" onClick={onNew} className="w-full justify-start">Novo agente</Button>}
    </section>
  );
}

export const AgentsSection = memo(AgentsSectionImpl);
