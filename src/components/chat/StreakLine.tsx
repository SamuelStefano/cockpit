import { useTurnTallyView } from '../../lib/gamify/useTurnTally';
import { tallyTitle } from '../../lib/gamify/turn-tally';

// Phone hero: the sidebar badge is not on screen there, so the streak sits under the title.
export function StreakLine() {
  const { streak, turns } = useTurnTallyView();
  if (streak < 1) return null;
  return <p className="-mt-4 mb-5 text-center text-[13px] text-orange-300 lg:hidden">{tallyTitle(streak, turns)}</p>;
}
