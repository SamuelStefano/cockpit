import { Icon, Tooltip, tokens } from '../../primitives';
import { Mascot } from '../../team/Mascot';
import type { BotView } from '../../../routes/equipe/team-view';

interface AgentRowProps {
  view: BotView;
  active: boolean;
  expanded: boolean;
  depth?: number;
  onOpen: (id: string) => void;
}

const INDENT_PX = 12;

function Dot({ view, rail }: { view: BotView; rail: boolean }) {
  const pending = !!view.pending;
  if (!pending && !view.unread) return null;
  const label = pending ? 'esperando você' : 'mensagem nova';
  const place = rail ? 'absolute right-0 top-0 ring-2 ring-neutral-950' : 'shrink-0';
  return <span role="img" aria-label={label} className={`h-2 w-2 rounded-full ${pending ? 'bg-orange-500' : 'bg-sky-500'} ${place}`} />;
}

// An agent in the sidebar: its mascot (live state), its name, one live phrase, and
// a dot when it waits on you (orange) or said something you have not read (blue).
// The hierarchy shows as indentation; the primary agent carries a star.
export function AgentRow({ view, active, expanded, depth = 0, onOpen }: AgentRowProps) {
  const { bot, state, preview } = view;
  return (
    <Tooltip label={bot.name} side="right" disabled={expanded} className={expanded ? 'flex min-w-0 flex-1' : 'inline-flex'}>
      <button
        type="button" onClick={() => onOpen(bot.id)} aria-label={bot.name} aria-current={active ? 'page' : undefined}
        style={expanded && depth ? { marginLeft: depth * INDENT_PX, width: `calc(100% - ${depth * INDENT_PX}px)` } : undefined}
        className={`flex items-center rounded-lg text-[13px] transition ${tokens.focusRing}
          ${expanded ? 'h-11 gap-2.5 px-2' : 'h-10 w-10 justify-center'}
          ${active ? 'bg-neutral-800/80 text-neutral-50' : 'text-neutral-300 hover:bg-neutral-800/50 hover:text-neutral-100'}`}
      >
        <span className="relative flex shrink-0">
          <Mascot mascot={bot.mascot} state={state} size={expanded ? 32 : 28} />
          {!expanded && <Dot view={view} rail />}
        </span>
        {expanded && (
          <span className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1 truncate font-medium">
              <span className="truncate">{bot.name}</span>
              {bot.primary && <Icon name="star" size={11} className="shrink-0 fill-orange-400 text-orange-400" />}
            </span>
            {preview && <span className="block truncate text-[12px] text-neutral-500">{preview}</span>}
          </span>
        )}
        {expanded && <Dot view={view} rail={false} />}
      </button>
    </Tooltip>
  );
}
