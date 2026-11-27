import { questsForDay } from '../../game/quests';
import type { GameState } from '../../game/types';

export function ArcadeQuests({ state, day }: { state: GameState; day: string }) {
  const today = state.daily.day === day ? state.daily : null;
  return (
    <ul className="flex flex-col gap-1">
      {questsForDay(day).map((q) => {
        const got = today?.progress[q.id] ?? 0;
        const done = !!today?.done.includes(q.id);
        return (
          <li key={q.id} className="flex items-baseline gap-2 text-[12px] leading-snug">
            <span className={`min-w-0 flex-1 truncate ${done ? 'text-neutral-600 line-through' : 'text-neutral-300'}`}>{q.title}</span>
            <span className="font-mono text-[10px] tabular-nums text-neutral-500">{got}/{q.goal}</span>
          </li>
        );
      })}
    </ul>
  );
}
