import { useState } from 'react';
import { Icon, IconButton, Tooltip, tokens } from '../primitives';
import { usePersisted } from '../../lib/persist';
import type { BotView } from '../../routes/equipe/team-view';
import { Mascot } from './Mascot';
import { TeamDot } from './TeamDot';
import { TeamRoster } from './TeamRoster';
import { orderTeam } from './team-order';

export const TEAM_RAIL_PINNED_KEY = 'teamRailPinned';
const SCROLL_FROM = 12;

export interface TeamRailProps {
  views: BotView[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  canManage: boolean;
  paused?: boolean;
  onPauseSet?: (paused: boolean) => void;
}

// A 56 px column at the chat's right edge: live mascots, hover opens a 240 px overlay,
// the pin keeps it open in the flow. Students get it read-only.
export function TeamRail({ views, activeId, onOpen, onNew, canManage, paused = false, onPauseSet }: TeamRailProps) {
  const [pinned, setPinned] = usePersisted<boolean>(TEAM_RAIL_PINNED_KEY, false);
  const [hover, setHover] = useState(false);
  // After unpinning, the pointer is still over the rail: hover must stay off until it leaves,
  // otherwise the rail seems to ignore the click and keeps covering the header controls.
  const [muted, setMuted] = useState(false);
  if (views.length === 0) return null;
  const entries = orderTeam(views);
  const open = pinned || hover;
  const scroll = views.length >= SCROLL_FROM;
  const canPause = canManage && views.length > 1 && !!onPauseSet;
  return (
    // Hover lives on the aside, not the overlay: the open overlay starts below the header
    // (top-12), so with the pointer in that strip it left the overlay, closed, grew back
    // under the pointer and reopened — a flicker loop. The aside spans the full height.
    <aside
      aria-label="Equipe"
      onMouseEnter={() => { if (!muted) setHover(true); }}
      onMouseLeave={() => { setHover(false); setMuted(false); }}
      onFocus={() => { if (!muted) setHover(true); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHover(false); }}
      className={`relative shrink-0 ${pinned ? 'w-60' : 'w-14'} transition-[width] duration-200 motion-reduce:transition-none`}>
      {!pinned && (
        <div aria-hidden className="absolute right-0 top-0 flex h-12 w-14 items-center justify-center border-l border-neutral-800 bg-neutral-950 text-neutral-500">
          <Icon name="users" size={16} />
        </div>
      )}
      <div
        data-open={open}
        className={`absolute right-0 z-30 flex flex-col border-l border-neutral-800 bg-neutral-950 transition-[width] duration-200 motion-reduce:transition-none ${pinned ? 'inset-y-0' : `top-12 bottom-0 ${open ? 'elev-2' : ''}`} ${open ? 'w-60' : 'w-14'}`}
      >
        {/* Unpinned, the header strip is the fixed placeholder above: the overlay never changes
            its top edge on hover, so the pointer can't fall in and out of it there. */}
        <div className={`flex h-12 shrink-0 items-center px-2 ${pinned || open ? '' : 'hidden'}`}>
          {open ? (
            <>
              <span className="flex-1 pl-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">Equipe</span>
              <IconButton icon="panelRight" label={pinned ? 'Soltar equipe' : 'Fixar equipe'} side="left" aria-pressed={pinned} size="sm" onClick={(e) => {
                if (pinned) { setMuted(true); setHover(false); e.currentTarget.blur(); }
                setPinned(!pinned);
              }} />
            </>
          ) : (
            <span className="flex w-full justify-center text-neutral-500"><Icon name="users" size={16} /></span>
          )}
        </div>
        <div className={`flex min-h-0 flex-1 flex-col gap-0.5 px-1.5 ${scroll ? 'scroll-thin overflow-y-auto' : 'overflow-hidden'}`}>
          {open ? (
            <TeamRoster entries={entries} activeId={activeId} onOpen={onOpen} />
          ) : entries.map(({ view }) => (
            <Tooltip key={view.bot.id} label={view.bot.name} side="left">
              <button
                type="button" onClick={() => onOpen(view.bot.id)} aria-label={view.bot.name} aria-current={view.bot.id === activeId ? 'page' : undefined}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tokens.focusRing} ${view.bot.id === activeId ? 'bg-neutral-800/80' : 'hover:bg-neutral-800/50'}`}
              >
                <span className="relative flex">
                  <Mascot mascot={view.bot.mascot} state={view.state} size={32} />
                  <TeamDot view={view} className="absolute -bottom-0.5 -right-0.5" />
                </span>
              </button>
            </Tooltip>
          ))}
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-col gap-0.5 border-t border-neutral-800/80 p-1.5">
            {canPause && (
              <RailAction open={open} icon={paused ? 'play' : 'pause'} label={paused ? 'Retomar equipe' : 'Pausar equipe'} onClick={() => onPauseSet?.(!paused)} />
            )}
            <RailAction open={open} icon="plus" label="Novo agente" onClick={onNew} />
          </div>
        )}
      </div>
    </aside>
  );
}

function RailAction({ open, icon, label, onClick }: { open: boolean; icon: 'plus' | 'pause' | 'play'; label: string; onClick: () => void }) {
  const btn = (
    <button type="button" onClick={onClick} aria-label={label} className={`flex h-9 items-center gap-2.5 rounded-lg text-[13px] text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-100 ${tokens.focusRing} ${open ? 'w-full px-2.5' : 'w-11 justify-center'}`}>
      <Icon name={icon} size={16} />
      {open && <span>{label}</span>}
    </button>
  );
  return open ? btn : <Tooltip label={label} side="left">{btn}</Tooltip>;
}
