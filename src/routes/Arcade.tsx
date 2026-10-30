import { EmptyState, Button, RouteHeader } from '../components/primitives';
import { useGameEnabled, useGameState } from '../game/useGameState';
import { dayKey, level } from '../game/engine';
import { navigateTo } from '../lib/route-nav';
import { ArcadeHeader } from '../components/game/ArcadeHeader';
import { ArcadeQuests } from '../components/game/ArcadeQuests';
import { ArcadeAchievements } from '../components/game/ArcadeAchievements';
import { ArcadeSecrets } from '../components/game/ArcadeSecrets';
import { BitRunner } from '../components/game/BitRunner';

export function Arcade() {
  const enabled = useGameEnabled();
  const state = useGameState();
  if (!enabled) {
    return (
      <EmptyState bit="sleeping" title="Arcade desligado" description="Nível, missões, conquistas e o Bit Runner ficam escondidos enquanto isso. Ligue em Configurações.">
        <Button variant="secondary" onClick={() => navigateTo('/configuracoes')}>Abrir Configurações</Button>
      </EmptyState>
    );
  }
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-5 md:px-8 md:py-7">
        <RouteHeader title="Arcade" variant="page" hideOnPhone />
        <ArcadeHeader info={level(state.xp)} streak={state.streak.current} xp={state.xp} />
        <ArcadeQuests state={state} day={dayKey(new Date())} />
        <BitRunner best={state.highScore} />
        <ArcadeAchievements state={state} />
        <ArcadeSecrets found={state.eggs} />
      </div>
    </div>
  );
}
