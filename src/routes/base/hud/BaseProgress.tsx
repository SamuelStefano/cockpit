import { useGameEnabled, useGameState } from '../../../game/useGameState';
import { dayKey, level } from '../../../game/engine';
import { questsForDay } from '../../../game/quests';
import { ACHIEVEMENTS } from '../../../game/achievements';
import { navigateTo } from '../../../lib/route-nav';
import { ProgressBar } from '../../../components/primitives';

// Real progress (XP comes from finished turns, merged PRs and done tasks), not the
// Practice simulation. Reads the game store, which only changes on a game event.
export function BaseProgress() {
  const enabled = useGameEnabled();
  const state = useGameState();
  if (!enabled) return null;
  const info = level(state.xp);
  const quests = questsForDay(dayKey(new Date()));
  const questsDone = quests.filter((q) => state.daily.done.includes(q.id)).length;
  const unlocked = Object.keys(state.unlocked).length;
  return (
    <button
      type="button"
      onClick={() => navigateTo('/arcade')}
      className="base-progress"
      title={`${info.title} · ${state.xp} XP · open Arcade`}
      aria-label={`Level ${info.level}, ${info.title}, ${state.xp} XP. Open Arcade`}
    >
      <b>Lv {info.level}</b>
      <ProgressBar size="xs" className="base-progress-bar" segments={[{ value: info.pct, tone: 'orange', label: `${state.xp} of ${info.next} XP` }, { value: 1 - info.pct, tone: 'track' }]} />
      {state.streak.current > 1 && <span className="base-streak">🔥{state.streak.current}</span>}
      <span className="base-dim">{questsDone}/{quests.length} quests · {unlocked}/{ACHIEVEMENTS.length}</span>
    </button>
  );
}
