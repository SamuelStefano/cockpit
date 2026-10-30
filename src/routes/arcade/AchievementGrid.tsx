import { SectionHeader } from '../../components/primitives';
import '../../components/game/game.css';
import { ACHIEVEMENTS } from '../../game/achievements';
import type { GameState } from '../../game/types';

export function AchievementGrid({ state }: { state: GameState }) {
  const got = ACHIEVEMENTS.filter((a) => state.unlocked[a.id]).length;
  return (
    <section>
      <SectionHeader title="Conquistas" icon="star" count={`${got}/${ACHIEVEMENTS.length}`} />
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const on = !!state.unlocked[a.id];
          const secret = !on && a.hidden;
          return (
            <li key={a.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${on ? 'border-orange-500/30 bg-orange-500/5' : 'border-neutral-800 bg-neutral-900/40'}`}>
              <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-800/80 text-[20px] ${on ? '' : 'arcade-locked'}`}>{secret ? '❓' : a.icon}</span>
              <div className="min-w-0">
                <p className={`truncate text-[13px] font-semibold ${on ? 'text-neutral-100' : 'text-neutral-500'}`}>{secret ? '???' : a.title}</p>
                <p className="line-clamp-2 text-[12px] text-neutral-500">{secret ? 'Conquista secreta' : a.desc}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
