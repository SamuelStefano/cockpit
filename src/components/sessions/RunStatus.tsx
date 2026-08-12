import { useEffect, useState } from 'react';
import { fmtRunElapsed } from './row-meta';

// Status do turno em voo no card do sidebar: cronômetro próprio (1s) só enquanto
// a sessão roda, então só a(s) linha(s) ativa(s) re-renderizam — não a lista toda.
export function RunStatus({ start, stalled }: { start?: number; stalled: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = start ? fmtRunElapsed(Math.max(0, Date.now() - start)) : null;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] font-medium">
      <span className={stalled ? 'text-amber-400' : 'text-green-400'}>
        {stalled ? 'sem resposta há um tempo' : 'trabalhando'}
      </span>
      {elapsed && <span className="tabular-nums text-neutral-500">{elapsed}</span>}
    </div>
  );
}
