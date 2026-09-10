import { useEffect, useState } from 'react';

// Relógio de 1s só enquanto a linha roda: assim apenas os cards em voo
// re-renderizam pra atualizar o tempo decorrido, não a lista inteira.
export function useRunClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
