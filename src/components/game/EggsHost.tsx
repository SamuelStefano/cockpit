import { useCallback, useEffect, useState } from 'react';
import { usePersisted } from '../../lib/persist';
import { GAME_CRT_KEY } from '../../lib/prefs';
import { toast } from '../primitives/toast-bus';
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

  useEggKeys({
    onKonami: () => {
      foundEgg('konami', 'Segredo encontrado: o código clássico.');
      toast(crt ? 'Modo CRT desligado.' : 'Modo CRT ligado. Digite o código de novo para desligar.', { durationMs: 3500 });
      setCrt(!crt);
    },
    onGod: () => {
      foundEgg('iddqd');
      toast('Modo deus: agentes não erram (mentira)', { durationMs: 4500 });
      setGod(false);
      window.setTimeout(() => setGod(true), 0);
    },
    onMatrix: () => {
      foundEgg('matrix', 'Segredo encontrado: siga o coelho branco.');
      setMatrix(true);
    },
  });
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
