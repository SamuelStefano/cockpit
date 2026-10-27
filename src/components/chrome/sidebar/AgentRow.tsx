import { Tooltip, tokens } from '../../primitives';
import { Mascot } from '../../team/Mascot';
import type { BotView } from '../../../routes/equipe/team-view';

interface AgentRowProps {
  view: BotView;
  active: boolean;
  expanded: boolean;
  onOpen: (id: string) => void;
}

function Dot({ view, rail }: { view: BotView; rail: boolean }) {
  const pending = !!view.pending;
  if (!pending && !view.unread) return null;
  const label = pending ? 'esperando você' : 'mensagem nova';
  const place = rail ? 'absolute right-0.5 top-0.5 ring-2 ring-neutral-950' : 'shrink-0';
  return <span role="img" aria-label={label} className={`h-2 w-2 rounded-full ${pending ? 'bg-orange-500' : 'bg-sky-500'} ${place}`} />;
}

// An agent in the sidebar: its mascot (live state), its name, and a dot when it
// waits on you (orange) or said something you have not read (blue).
export function AgentRow({ view, active, expanded, onOpen }: AgentRowProps) {
  const { bot, state } = view;
  return (
    <Tooltip label={bot.name} side="right" disabled={expanded} className={expanded ? 'flex min-w-0 flex-1' : 'inline-flex'}>
      <button
        type="button" onClick={() => onOpen(bot.id)} aria-label={bot.name} aria-current={active ? 'page' : undefined}
        className={`flex h-10 items-center rounded-lg text-[13px] transition pointer-coarse:h-11 ${tokens.focusRing}
          ${expanded ? 'w-full gap-2.5 pl-2.5 pr-2' : 'w-10 justify-center'}
          ${active ? 'bg-orange-500/15 text-orange-200' : 'text-neutral-300 hover:bg-neutral-800/70 hover:text-neutral-100'}`}
      >
        <span className="relative flex shrink-0">
          <Mascot mascot={bot.mascot} state={state} size={expanded ? 22 : 26} />
          {!expanded && <Dot view={view} rail />}
        </span>
        {expanded && <span className="min-w-0 flex-1 truncate text-left">{bot.name}</span>}
        {expanded && <Dot view={view} rail={false} />}
      </button>
    </Tooltip>
  );
}
