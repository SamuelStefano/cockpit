import { Bit } from '../../components/bit/Bit';
import { Badge, ProgressBar, Stat } from '../../components/primitives';
import '../../components/game/game.css';
import { EGG_IDS, ornamentFor } from '../../game/eggs';
import type { LevelInfo } from '../../game/engine';
import type { GameState } from '../../game/types';
import { useBitPoke } from './useBitPoke';

interface ProfileCardProps { state: GameState; info: LevelInfo; total: number }

export function ProfileCard({ state, info, total }: ProfileCardProps) {
  const { state: bitState, shake, quip, poke } = useBitPoke();
  const ornament = ornamentFor(new Date());
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 hairline">
      <div className="relative flex w-28 shrink-0 flex-col items-center">
        {quip && <span role="status" className="arcade-pixel absolute -top-7 z-10 whitespace-nowrap rounded-lg border border-orange-500/40 bg-neutral-950 px-2 py-1 text-[11px] text-orange-200">{quip}</span>}
        <button type="button" onClick={poke} aria-label="Bit" className={`relative rounded-xl ${shake ? 'arcade-shake' : ''}`}>
          <Bit state={bitState ?? 'idle'} size={96} />
          {ornament && <span aria-hidden className="absolute -top-1 right-2 text-[26px]">{ornament}</span>}
        </button>
      </div>
      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="orange" className="font-mono">Nv {info.level}</Badge>
          <h2 className="text-[18px] font-bold text-neutral-100">{info.title}</h2>
        </div>
        <div className="mt-3">
          <ProgressBar segments={[{ value: info.pct, tone: 'orange', label: `${state.xp} de ${info.next} XP` }, { value: 1 - info.pct, tone: 'track' }]} />
          <p className="mt-1 font-mono text-[12px] tabular-nums text-neutral-500">{state.xp} / {info.next} XP</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat compact label="sequência" value={`🔥 ${state.streak.current}d`} sub={`recorde ${state.streak.best}d`} />
          <Stat compact label="turnos" value={state.totals.turn_done ?? 0} />
          <Stat compact label="conquistas" value={`${Object.keys(state.unlocked).length}/${total}`} />
          <Stat compact label="segredos" value={`${state.eggs.filter((e) => (EGG_IDS as readonly string[]).includes(e)).length}/${EGG_IDS.length}`} sub="encontrados" />
        </div>
      </div>
    </div>
  );
}
