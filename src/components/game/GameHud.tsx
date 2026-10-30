import { Badge, ProgressBar } from '../primitives';
import { useGameHud } from '../../game/useGameHud';

// Compact level + XP + streak line for the sidebar footer; the whole thing opens /arcade.
export function GameHud({ expanded, onOpen }: { expanded: boolean; onOpen: () => void }) {
  const { enabled, info, streak, xp } = useGameHud();
  if (!enabled) return null;
  const label = `Arcade: nível ${info.level}, ${info.title}, ${xp} XP${streak > 1 ? `, sequência de ${streak} dias` : ''}`;
  const bar = <ProgressBar size="xs" segments={[{ value: info.pct, tone: 'orange' }, { value: 1 - info.pct, tone: 'track' }]} />;
  if (!expanded) {
    return (
      <button type="button" onClick={onOpen} aria-label={label} title={label} className="flex w-full flex-col items-center gap-1 rounded-md px-1 py-1.5 hover:bg-neutral-800/60">
        <span className="font-mono text-[11px] font-semibold text-orange-300">{info.level}</span>
        <span className="w-7">{bar}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} aria-label={label} title={`${info.title} · ${xp} XP`} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-800/60">
      <Badge tone="orange" className="shrink-0 font-mono">Nv {info.level}</Badge>
      <span className="min-w-0 flex-1">{bar}</span>
      {streak > 1 && <span className="shrink-0 font-mono text-[12px] text-orange-300">🔥{streak}</span>}
    </button>
  );
}
