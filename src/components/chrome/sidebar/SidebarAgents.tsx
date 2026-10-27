import { IconButton } from '../../primitives';
import type { BotView } from '../../../routes/equipe/team-view';
import { AgentRow } from './AgentRow';

export interface SidebarAgentsProps {
  views: BotView[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  paused?: boolean;
  onPauseSet?: (paused: boolean) => void;
}

const RAIL_MAX = 5;

export function agentDepths(views: BotView[]): Map<string, number> {
  const parent = new Map(views.map((v) => [v.bot.id, v.bot.parentId]));
  const depth = (id: string, seen: Set<string>): number => {
    const p = parent.get(id);
    if (!p || !parent.has(p) || seen.has(p)) return 0;
    seen.add(p);
    return 1 + depth(p, seen);
  };
  return new Map(views.map((v) => [v.bot.id, depth(v.bot.id, new Set([v.bot.id]))]));
}

// The team, as a section of the sidebar: only when there is at least one agent.
export function SidebarAgents({ views, activeId, onOpen, onNew, paused = false, onPauseSet, expanded }: SidebarAgentsProps & { expanded: boolean }) {
  if (views.length === 0) return null;
  const depths = agentDepths(views);
  const row = (v: BotView) => <AgentRow key={v.bot.id} view={v} active={v.bot.id === activeId} expanded={expanded} depth={depths.get(v.bot.id)} onOpen={onOpen} />;
  if (!expanded) return <div className="flex flex-col items-center gap-0.5">{views.slice(0, RAIL_MAX).map(row)}</div>;
  return (
    <section aria-label="Agentes" className="flex flex-col">
      <div className="flex h-8 items-center justify-between pl-2.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">Agentes</h2>
        <div className="flex items-center">
          {onPauseSet && views.length > 1 && (
            <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Retomar equipe' : 'Pausar equipe'} side="right" size="sm"
              aria-pressed={paused} onClick={() => onPauseSet(!paused)} />
          )}
          <IconButton icon="plus" label="Novo bot" side="right" size="sm" onClick={onNew} />
        </div>
      </div>
      {paused && <p className="px-2.5 pb-1 text-[12px] text-yellow-400/90">Mensagens entre agentes pausadas.</p>}
      <div className="scroll-thin flex max-h-[34vh] flex-col gap-0.5 overflow-y-auto">{views.map(row)}</div>
    </section>
  );
}
