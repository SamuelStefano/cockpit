import { Icon, Tooltip } from '../primitives';
import { tallyTitle } from '../../lib/gamify/turn-tally';

interface StreakBadgeProps {
  streak: number;
  turns: number;
}

// Days in a row with a finished turn: a flame and a number, quiet until there is a streak.
export function StreakBadge({ streak, turns }: StreakBadgeProps) {
  if (streak < 1) return null;
  const title = tallyTitle(streak, turns);
  return (
    <Tooltip label={title} side="bottom">
      <span aria-label={title} className="flex shrink-0 items-center gap-0.5 rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums text-orange-300">
        <Icon name="zap" size={12} />{streak}
      </span>
    </Tooltip>
  );
}
