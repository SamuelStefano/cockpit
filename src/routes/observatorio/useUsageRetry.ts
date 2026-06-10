import { useEffect, useRef, useState } from 'react';

// A telemetria às vezes não chegava: a resposta de `usage-list` pode se perder
// num reconnect do relay (T3) e o painel ficava no skeleton pra sempre, sem novo
// pedido. Aqui, enquanto conectado e ainda sem dados, repete o pedido algumas
// vezes com espaço entre elas; para assim que os dados chegam ou ao esgotar.
export const USAGE_RETRY_MS = 2500;
export const USAGE_RETRY_MAX = 5;

export function useUsageRetry(connected: boolean, hasData: boolean, request: () => void): void {
  const tries = useRef(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!connected || hasData) { tries.current = 0; return; }
    if (tries.current >= USAGE_RETRY_MAX) return;
    const id = setTimeout(() => { tries.current += 1; request(); setTick((n) => n + 1); }, USAGE_RETRY_MS);
    return () => clearTimeout(id);
  }, [connected, hasData, request, tick]);
}
