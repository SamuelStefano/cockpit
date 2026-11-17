import { tokens } from '../../components/primitives';
import { BOT_STATE_LABEL } from '../../components/team/botState';
import { Mascot } from '../../components/team/Mascot';
import type { BotView } from '../equipe/team-view';
import { STATE_DOT } from './office-view';

interface AgentDeskProps { view: BotView; isLeader: boolean; wide?: boolean; onOpen: (id: string) => void }

export function AgentDesk({ view, isLeader, wide = false, onOpen }: AgentDeskProps) {
  const { bot, state } = view;
  return (
    <button
      type="button" onClick={() => onOpen(bot.id)} aria-label={bot.name}
      className={`${wide ? 'sm:col-span-2 ' : ''}relative flex min-w-0 items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/70 px-2.5 py-2 text-left transition hover:border-neutral-700 hover:bg-neutral-800/60 ${tokens.focusRing}`}
    >
      <Mascot mascot={bot.mascot} state={state} size={38} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-neutral-50">{bot.name}</span>
          {isLeader && <span className="shrink-0 rounded-md border border-neutral-700 px-1.5 text-[10.5px] text-neutral-400">chefe</span>}
        </span>
        {bot.label && <span className="block truncate text-[11.5px] text-neutral-500">{bot.label}</span>}
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
          <span aria-hidden className={`size-1.75 shrink-0 rounded-full ${STATE_DOT[state]}`} />
          <span className="truncate">{BOT_STATE_LABEL[state]}</span>
        </span>
      </span>
    </button>
  );
}
