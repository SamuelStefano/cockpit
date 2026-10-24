import { Mascot } from '../../components/team/Mascot';
import { tokens } from '../../components/primitives';
import type { BotView } from './team-view';

interface BotRowProps { view: BotView; selected: boolean; onSelect: (id: string) => void }

export function BotRow({ view, selected, onSelect }: BotRowProps) {
  const { bot, preview, unread, state } = view;
  return (
    <button
      type="button" onClick={() => onSelect(bot.id)} aria-current={selected ? 'true' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${selected ? 'bg-neutral-800/70' : 'hover:bg-neutral-900'} ${tokens.focusRing}`}
    >
      <Mascot mascot={bot.mascot} state={state} size={40} name={bot.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-neutral-100">{bot.name}</span>
        <span className="block truncate text-[12.5px] text-neutral-500">{preview}</span>
      </span>
      {unread && <span aria-label="mensagem nova" className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />}
    </button>
  );
}
