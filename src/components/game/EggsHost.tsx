import { useCallback, useEffect, useState } from 'react';
import { usePersisted } from '../../lib/persist';
import { GAME_CRT_KEY } from '../../lib/prefs';
import { showPill } from '../../game/pill-bus';
import { subscribeEggTrigger, type EggTrigger } from '../../game/egg-bus';
import { useGameEnabled } from '../../game/useGameState';
import { useEggKeys } from '../../game/useEggKeys';
import { useSeasonalEggs } from '../../game/useSeasonalEggs';
import { foundEgg } from '../../game/found-egg';
import { CrtOverlay } from './CrtOverlay';
import { GodGlow } from './GodGlow';
import { MatrixRain } from './MatrixRain';

const GOD_MS = 30_000;

function Layer() {
  const [crt, setCrt] = usePersisted<boolean>(GAME_CRT_KEY, false);
  const [god, setGod] = useState(false);
  const [matrix, setMatrix] = useState(false);

  useEffect(() => {
    if (!god) return;
    const t = window.setTimeout(() => setGod(false), GOD_MS);
    return () => window.clearTimeout(t);
  }, [god]);

  const fire = useCallback((id: EggTrigger) => {
    if (id === 'konami') {
      foundEgg('konami');
      showPill({ icon: '📺', title: crt ? 'Modo CRT desligado' : 'Modo CRT ligado (digite o código de novo para desligar)' });
      setCrt(!crt);
    } else if (id === 'iddqd') {
      foundEgg('iddqd');
      showPill({ icon: '😇', title: 'Modo deus: agentes não erram (mentira)' });
      setGod(false);
      window.setTimeout(() => setGod(true), 0);
    } else {
      foundEgg('matrix');
      setMatrix(true);
    }
  }, [crt, setCrt]);

  // Typed codes only count outside text fields (useEggKeys drops keys from inputs);
  // the palette reaches the same effects through the egg bus.
  useEggKeys({ onKonami: () => fire('konami'), onGod: () => fire('iddqd'), onMatrix: () => fire('matrix') });
  useEffect(() => subscribeEggTrigger(fire), [fire]);
  useSeasonalEggs();
  const stopMatrix = useCallback(() => setMatrix(false), []);

  return (
    <>
      {crt && <CrtOverlay />}
      {god && <GodGlow />}
      {matrix && <MatrixRain onDone={stopMatrix} />}
    </>
  );
}

export function EggsHost() {
  const enabled = useGameEnabled();
  return enabled ? <Layer /> : null;
}
