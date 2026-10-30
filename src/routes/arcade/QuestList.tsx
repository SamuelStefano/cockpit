import { Badge, ProgressBar, SectionHeader } from '../../components/primitives';
import { questsForDay, QUEST_BONUS_XP } from '../../game/quests';
import type { GameState } from '../../game/types';

export function QuestList({ state, day }: { state: GameState; day: string }) {
  const quests = questsForDay(day);
  const today = state.daily.day === day ? state.daily : null;
  const done = quests.filter((q) => today?.done.includes(q.id)).length;
  return (
    <section>
      <SectionHeader title="Missões de hoje" icon="check" count={`${done}/${quests.length}`} description={`Complete as 3 e ganhe +${QUEST_BONUS_XP} XP de bônus. Renovam à meia-noite.`} />
      <ul className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 hairline">
        {quests.map((q) => {
          const got = today?.progress[q.id] ?? 0;
          const complete = !!today?.done.includes(q.id);
          return (
            <li key={q.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] ${complete ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>{q.title}</p>
                <ProgressBar size="xs" className="mt-2" segments={[{ value: got, tone: complete ? 'green' : 'orange', label: `${got}/${q.goal}` }, { value: q.goal - got, tone: 'track' }]} />
              </div>
              <span className="font-mono text-[12px] tabular-nums text-neutral-500">{got}/{q.goal}</span>
              <Badge tone={complete ? 'green' : 'neutral'}>+{q.xp} XP</Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
