import { IconButton } from '../../primitives';
import type { BotView } from '../../../routes/equipe/team-view';
import { AgentRow } from './AgentRow';
import { SidebarItem } from './SidebarItem';

export interface SidebarAgentsProps {
  views: BotView[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  paused?: boolean;
  onPauseSet?: (paused: boolean) => void;
}

const RAIL_MAX = 5;

// The team, as a section of the sidebar. With zero or one agent it is a single
// row, so a one-agent Deck reads like a plain chat app.
export function SidebarAgents({ views, activeId, onOpen, onNew, paused = false, onPauseSet, expanded }: SidebarAgentsProps & { expanded: boolean }) {
  const row = (v: BotView) => <AgentRow key={v.bot.id} view={v} active={v.bot.id === activeId} expanded={expanded} onOpen={onOpen} />;
  if (!expanded) return views.length ? <div className="flex flex-col items-center gap-0.5">{views.slice(0, RAIL_MAX).map(row)}</div> : null;
  if (views.length === 0) return <SidebarItem icon="users" label="Criar agente" expanded onClick={onNew} />;
  const add = <IconButton icon="plus" label="Novo bot" side="right" size="sm" onClick={onNew} />;
  if (views.length === 1) return <div className="flex items-center gap-0.5">{row(views[0])}{add}</div>;
  return (
    <section aria-label="Agentes" className="flex flex-col">
      <div className="flex h-8 items-center justify-between pl-2.5">
        <h2 className="text-[12px] font-medium uppercase tracking-wide text-neutral-500">Agentes</h2>
        <div className="flex items-center">
          {onPauseSet && (
            <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Retomar equipe' : 'Pausar equipe'} side="right" size="sm"
              aria-pressed={paused} onClick={() => onPauseSet(!paused)} />
          )}
          {add}
        </div>
      </div>
      {paused && <p className="px-2.5 pb-1 text-[12px] text-yellow-400/90">Mensagens entre agentes pausadas.</p>}
      <div className="scroll-thin flex max-h-[30vh] flex-col gap-0.5 overflow-y-auto">{views.map(row)}</div>
    </section>
  );
}
