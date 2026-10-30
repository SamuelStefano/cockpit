import './game.css';
import { Bit } from '../bit/Bit';
import { ornamentFor } from '../../game/eggs';
import type { LevelInfo } from '../../game/engine';
import { ArcadeStats } from './ArcadeStats';
import { useBitPoke } from './useBitPoke';

// The small Bit is the home of the poke eggs.
export function ArcadeHeader({ info, streak, xp }: { info: LevelInfo; streak: number; xp: number }) {
  const { state, shake, quip, poke } = useBitPoke();
  const ornament = ornamentFor(new Date());
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={poke} aria-label="Bit" className={`relative shrink-0 rounded-md ${shake ? 'arcade-shake' : ''}`}>
        <Bit state={state ?? 'idle'} size={28} title="Bit" />
        {ornament && <span aria-hidden className="absolute -right-1 -top-1 text-[11px]">{ornament}</span>}
      </button>
      <ArcadeStats info={info} streak={streak} xp={xp} />
      {quip && <span role="status" className="arcade-pixel max-w-[110px] text-[10px] leading-tight text-orange-200">{quip}</span>}
    </div>
  );
}
