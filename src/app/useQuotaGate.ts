import { useEffect, useState } from 'react';
import type { PlanUsage } from '../../shared/protocol';
import { quotaGate, type QuotaGate, type RateInfo } from './quota-gate';

// Timer no reset MAIS PRÓXIMO entre o teto do plano e o limite duro: sem ele o
// `paused` só recomputava no próximo push do servidor (até 60s) e o usuário
// precisava dar F5 pra fila voltar a andar depois da janela resetar.
export function useQuotaGate(planUsage: PlanUsage | null, rate: RateInfo | null): QuotaGate {
  const [tick, setTick] = useState(0);
  const gate = quotaGate(planUsage, rate, Date.now());
  const { nextResetAt } = gate;
  useEffect(() => {
    void tick; // dep só pra reagendar após o disparo
    if (nextResetAt === null) return;
    const t = setTimeout(() => setTick((n) => n + 1), nextResetAt - Date.now() + 1000);
    return () => clearTimeout(t);
  }, [nextResetAt, tick]);
  return gate;
}
