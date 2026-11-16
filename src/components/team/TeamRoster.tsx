import { Icon, tokens } from '../primitives';
import { Mascot } from './Mascot';
import { LivingPhrase } from './LivingPhrase';
import { TeamDot } from './TeamDot';
import type { TeamEntry } from './team-order';

const INDENT_PX = 12;

interface TeamRosterProps {
  entries: TeamEntry[];
  activeId: string | null;
  onOpen: (id: string) => void;
  rowHeight?: number;
  indent?: boolean;
  phrases?: boolean;
  mascotSize?: number;
  // Leads with hidden-able workers: `counts` is how many each has, `open` the expanded ones.
  fold?: { counts: Record<string, number>; open: readonly string[]; onToggle: (id: string) => void };
}

// The roster rows shared by the expanded rail and the team sheet: mascot, name, star, live phrase.
export function TeamRoster({ entries, activeId, onOpen, rowHeight = 44, indent = true, phrases = true, mascotSize = 32, fold }: TeamRosterProps) {
  return (
    <>
      {entries.map(({ view, depth }) => {
        const { bot, state, preview } = view;
        const live = state === 'thinking' || state === 'working';
        const count = fold?.counts[bot.id] ?? 0;
        const expanded = !!fold?.open.includes(bot.id);
        const row = (
          <button
            key={bot.id} type="button" onClick={() => onOpen(bot.id)} aria-label={bot.name} aria-current={bot.id === activeId ? 'page' : undefined}
            style={{ height: rowHeight, marginLeft: indent ? depth * INDENT_PX : 0, width: indent ? `calc(100% - ${depth * INDENT_PX}px)` : '100%' }}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-1.5 text-left text-[13px] transition ${tokens.focusRing} ${bot.id === activeId ? 'bg-neutral-800/80 text-neutral-50' : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-neutral-100'}`}
          >
            <span className="relative flex shrink-0">
              <Mascot mascot={bot.mascot} state={state} size={mascotSize} />
              <TeamDot view={view} className="absolute -bottom-0.5 -right-0.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 font-medium">
                <span className="truncate">{bot.name}</span>
                {bot.primary && <Icon name="star" size={11} className="shrink-0 fill-orange-400 text-orange-400" />}
                {count > 0 && !expanded && <span className="shrink-0 text-[11px] font-normal text-neutral-500">· +{count}</span>}
              </span>
              {phrases && (live
                ? <LivingPhrase active startedAt={view.startedAt} className="text-[12px] text-neutral-500" />
                : preview && <span className="block truncate text-[12px] text-neutral-500">{preview}</span>)}
            </span>
          </button>
        );
        if (!count || !fold) return row;
        return (
          <div key={bot.id} className="relative">
            {row}
            <button
              type="button" onClick={() => fold.onToggle(bot.id)} aria-expanded={expanded} aria-label={`${expanded ? 'Recolher' : 'Expandir'} ${bot.name}`}
              className={`absolute right-0 top-0 flex w-11 items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-200 ${tokens.focusRing}`} style={{ height: rowHeight }}
            >
              <Icon name="chevronDown" size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        );
      })}
    </>
  );
}
