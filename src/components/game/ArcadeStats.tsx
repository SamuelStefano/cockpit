import { ProgressBar } from '../primitives';
import type { LevelInfo } from '../../game/engine';

export function ArcadeStats({ info, streak, xp }: { info: LevelInfo; streak: number; xp: number }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-mono text-[12px] leading-none text-neutral-200" title={`${info.title} · ${xp} XP`}>
        Nv {info.level}{streak > 1 ? ` · 🔥${streak}` : ''}
      </p>
      <ProgressBar size="xs" className="mt-1.5 h-px" segments={[{ value: info.pct, tone: 'orange', label: `${xp} de ${info.next} XP` }, { value: 1 - info.pct, tone: 'track' }]} />
    </div>
  );
}
