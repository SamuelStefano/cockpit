import { useEffect, useRef } from 'react';
import { EmptyState, Button, RouteHeader } from '../components/primitives';
import { useGameEnabled, useGameState } from '../game/useGameState';
import { ACHIEVEMENTS } from '../game/achievements';
import { dayKey, level } from '../game/engine';
import { takeRunnerIntent } from '../game/runner-intent';
import { navigateTo } from '../lib/route-nav';
import { ProfileCard } from './arcade/ProfileCard';
import { QuestList } from './arcade/QuestList';
import { AchievementGrid } from './arcade/AchievementGrid';
import { BitRunner } from './arcade/BitRunner';

export function Arcade() {
  const enabled = useGameEnabled();
  const state = useGameState();
  const runner = useRef<HTMLElement>(null);

  useEffect(() => {
    if (enabled && takeRunnerIntent()) runner.current?.scrollIntoView({ block: 'center' });
  }, [enabled]);

  if (!enabled) {
    return (
      <EmptyState bit="sleeping" title="Arcade desligado" description="Nível, missões, conquistas e o Bit Runner ficam escondidos enquanto isso. Ligue em Configurações.">
        <Button variant="secondary" onClick={() => navigateTo('/configuracoes')}>Abrir Configurações</Button>
      </EmptyState>
    );
  }
  const day = dayKey(new Date());
  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-4 py-5 md:px-8 md:py-7">
        <RouteHeader title="Arcade" subtitle="Seu progresso no Deck, neste aparelho." variant="page" hideOnPhone />
        <ProfileCard state={state} info={level(state.xp)} total={ACHIEVEMENTS.length} />
        <QuestList state={state} day={day} />
        <BitRunner ref={runner} best={state.highScore} />
        <AchievementGrid state={state} />
      </div>
    </div>
  );
}
