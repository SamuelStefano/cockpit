import { dayKey, level } from '../../game/engine';
import { requestArcade } from '../../game/arcade-bus';
import type { GameState } from '../../game/types';
import { ArcadeHeader } from './ArcadeHeader';
import { ArcadeQuests } from './ArcadeQuests';
import { ArcadeAchievements } from './ArcadeAchievements';
import { ArcadeSecrets } from './ArcadeSecrets';

// Everything the Arcade shows, in one small popover. `onClose` runs before the
// runner modal opens so two layers never stack.
export function ArcadePanel({ state, onClose }: { state: GameState; onClose: () => void }) {
  const info = level(state.xp);
  return (
    <div className="flex w-[min(280px,100%)] flex-col gap-3 p-3 max-sm:mx-auto">
      <ArcadeHeader info={info} streak={state.streak.current} xp={state.xp} />
      <ArcadeQuests state={state} day={dayKey(new Date())} />
      <ArcadeAchievements state={state} />
      <ArcadeSecrets found={state.eggs} />
      <button
        type="button"
        onClick={() => { onClose(); requestArcade('runner'); }}
        className="self-start text-[12px] font-medium text-orange-400 hover:text-orange-300 focus-visible:outline-hidden focus-visible:underline"
      >
        Jogar
      </button>
    </div>
  );
}
