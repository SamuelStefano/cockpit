import { Mascot } from '../../components/team/Mascot';
import { PrimaryStar } from '../../components/team/PrimaryStar';
import { tokens } from '../../components/primitives';
import type { BotView } from './team-view';

interface PrimaryCardProps { view: BotView; selected: boolean; onSelect: (id: string) => void }

export function PrimaryCard({ view, selected, onSelect }: PrimaryCardProps) {
  const { bot, state, unread } = view;
  return (
    <button
      type="button" onClick={() => onSelect(bot.id)} aria-current={selected ? 'true' : undefined}
      className={`relative mx-auto flex w-36 flex-col items-center gap-1.5 rounded-2xl px-3 pb-3 pt-4 transition ${selected ? 'bg-neutral-800/70' : 'bg-neutral-900/60 hover:bg-neutral-800/50'} ${tokens.focusRing}`}
    >
      <span className="relative">
        <Mascot mascot={bot.mascot} state={state} size={64} name={bot.name} />
        <span className="absolute -bottom-0.5 -right-0.5"><PrimaryStar size={18} /></span>
      </span>
      <span className="max-w-full truncate text-[14px] font-medium text-neutral-100">{bot.name}</span>
      {bot.label && <span className="max-w-full truncate rounded-md bg-neutral-800 px-1.5 py-0.5 text-[11.5px] text-neutral-400">{bot.label}</span>}
      {unread && <span aria-label="mensagem nova" className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-sky-500" />}
    </button>
  );
}
