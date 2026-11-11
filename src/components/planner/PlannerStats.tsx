import type { PlannerTask } from '../../../shared/planner';
import { Icon, ProgressBar } from '../primitives';
import { doneTodayCount, levelProgress, streakDays, totalXp } from '../../planner/planner-logic';

export function PlannerStats({ tasks, now }: { tasks: PlannerTask[]; now: number }) {
  const xp = totalXp(tasks);
  const { level, into, need } = levelProgress(xp);
  const streak = streakDays(tasks, now);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-neutral-800 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 font-display text-[17px] font-bold text-orange-300 shadow-[0_3px_0_0_rgba(194,65,12,0.5)]" aria-label={`Nível ${level}`}>{level}</span>
        <div className="w-40 max-sm:w-32">
          <div className="flex justify-between font-mono text-[12px] text-neutral-400"><span>Nível {level}</span><span>{into}/{need} XP</span></div>
          <ProgressBar segments={[{ value: into, tone: 'orange', label: `${into} de ${need} XP` }, { value: need - into, tone: 'track' }]} />
        </div>
      </div>
      <span className="text-[13px] text-neutral-300">hoje: <b className="text-neutral-100">{doneTodayCount(tasks, now)}</b> feitas</span>
      <span className="flex items-center gap-1 text-[13px] text-neutral-300" title="Dias seguidos com ao menos uma task feita">
        <Icon name="zap" size={14} className={streak ? 'text-orange-400' : 'text-neutral-600'} />
        <b className="text-neutral-100">{streak}</b> {streak === 1 ? 'dia' : 'dias'}
      </span>
    </div>
  );
}
