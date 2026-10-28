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
}

// The roster rows shared by the expanded rail and the team sheet: mascot, name, star, live phrase.
export function TeamRoster({ entries, activeId, onOpen, rowHeight = 44, indent = true, phrases = true }: TeamRosterProps) {
  return (
    <>
      {entries.map(({ view, depth }) => {
        const { bot, state, preview } = view;
        const live = state === 'thinking' || state === 'working';
        return (
          <button
            key={bot.id} type="button" onClick={() => onOpen(bot.id)} aria-label={bot.name} aria-current={bot.id === activeId ? 'page' : undefined}
            style={{ height: rowHeight, marginLeft: indent ? depth * INDENT_PX : 0, width: indent ? `calc(100% - ${depth * INDENT_PX}px)` : '100%' }}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-1.5 text-left text-[13px] transition ${tokens.focusRing} ${bot.id === activeId ? 'bg-neutral-800/80 text-neutral-50' : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-neutral-100'}`}
          >
            <span className="relative flex shrink-0">
              <Mascot mascot={bot.mascot} state={state} size={32} />
              <TeamDot view={view} className="absolute -bottom-0.5 -right-0.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 font-medium">
                <span className="truncate">{bot.name}</span>
                {bot.primary && <Icon name="star" size={11} className="shrink-0 fill-orange-400 text-orange-400" />}
              </span>
              {phrases && (live
                ? <LivingPhrase active startedAt={view.startedAt} className="text-[12px] text-neutral-500" />
                : preview && <span className="block truncate text-[12px] text-neutral-500">{preview}</span>)}
            </span>
          </button>
        );
      })}
    </>
  );
}
