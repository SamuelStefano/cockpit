import { Icon } from '../../components/primitives';
import { Mascot } from '../../components/team/Mascot';
import { LivingPhrase } from '../../components/team/LivingPhrase';
import type { BotView } from './team-view';

interface OrgNodeProps {
  view: BotView;
  onOpen: (id: string) => void;
}

export function OrgNode({ view, onOpen }: OrgNodeProps) {
  const { bot, state } = view;
  const live = state === 'thinking' || state === 'working';
  return (
    <button
      type="button" onClick={() => onOpen(bot.id)} aria-label={`Abrir ${bot.name}`}
      className="hairline relative flex w-42 flex-col items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/45 px-4 pb-3 pt-3.5 text-center transition hover:border-neutral-700"
    >
      {bot.primary && <Icon name="star" size={12} className="absolute right-2 top-2 fill-orange-500 text-orange-500" />}
      <Mascot mascot={bot.mascot} state={state} size={40} />
      <span className="max-w-full truncate text-[14px] font-medium text-neutral-100">{bot.name}</span>
      <span className="max-w-full truncate text-[12px] text-neutral-500">{bot.label || 'Sem cargo'}</span>
      <span className="mt-1 min-h-4 max-w-full truncate text-[12px] text-neutral-400">
        {live
          ? <LivingPhrase active startedAt={view.startedAt} />
          : <span className={view.preview ? '' : 'text-neutral-600'}>{view.pending ? 'Esperando você' : state === 'idle' ? 'Livre' : view.preview}</span>}
      </span>
    </button>
  );
}
