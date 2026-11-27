import type { TeamStateBot } from '../../../shared/team-state';
import { monogram, tintFor } from '../../cockpit/agents-view';

const DOT: Record<TeamStateBot['status'], string> = { working: 'bg-green-500', waiting: 'bg-yellow-400', idle: 'bg-neutral-600' };
const STATUS_LABEL: Record<TeamStateBot['status'], string> = { working: 'Trabalhando', waiting: 'Precisa de você', idle: 'Ociosa' };

export function BotRow({ bot, recording, onOpen }: { bot: TeamStateBot; recording: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 border-b border-neutral-800/70 px-4 py-3 text-left transition last:border-b-0 hover:bg-neutral-900/60">
      <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold ${tintFor(bot.id)}`}>
        {monogram(bot.name)}
        <span aria-hidden className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-neutral-950 ${DOT[bot.status]}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-neutral-100">{bot.name}</span>
        <span className="block truncate text-[12px] text-neutral-500">{bot.role}</span>
        {recording
          ? <span className="block text-[12px] text-neutral-500">{STATUS_LABEL[bot.status]}</span>
          : bot.task && <span className="line-clamp-2 text-[13px] text-neutral-300">{bot.task}</span>}
      </span>
    </button>
  );
}
