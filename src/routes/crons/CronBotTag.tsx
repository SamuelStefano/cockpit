import type { TeamBot } from '../../../shared/protocol';
import { Badge } from '../../components/primitives';
import { Mascot } from '../../components/team/Mascot';

// A bot routine runs in the bot's thread, so the card names whose routine it is.
export function CronBotTag({ bot }: { bot: TeamBot | undefined }) {
  if (!bot) return <Badge tone="neutral">bot removido</Badge>;
  return (
    <span className="flex items-center gap-1 text-[12px] text-neutral-400">
      <Mascot mascot={bot.mascot} size={16} name={bot.name} />{bot.name}
    </span>
  );
}
