import { useCallback, useEffect, useState } from 'react';

// Detecta loading travado: a lista foi pedida mas 'loaded' nunca chegou (backend
// não respondeu). Sem isso o skeleton gira pra sempre sem saída pro usuário.
export function useLoadStalled(loaded: boolean, active: boolean, ms = 12_000) {
  const [stalled, setStalled] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active || loaded) {
      setStalled(false);
      return;
    }
    const t = setTimeout(() => setStalled(true), ms);
    return () => clearTimeout(t);
  }, [active, loaded, ms, attempt]);

  const retry = useCallback(() => {
    setStalled(false);
    setAttempt((a) => a + 1);
  }, []);

  return { stalled, retry };
}
