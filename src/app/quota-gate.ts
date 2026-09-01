import type { PlanUsage } from '../../shared/protocol';

export interface RateInfo {
  resetsAt: number;
  status: string;
}

export interface QuotaGate {
  // Teto batido: o composer trava e a fila persistida não drena.
  paused: boolean;
  // Banner de aviso (já no warning, sem travar o envio).
  warn: boolean;
  // Quando a janela volta a aceitar envio, pro rótulo do banner e do composer.
  resetsAt: number | null;
  // Próximo reset a agendar; null = nada futuro pra esperar.
  nextResetAt: number | null;
}

// O CLI manda 'allowed' (longe do teto), 'allowed_warning' (perto, mas AINDA PODE
// enviar) e 'rejected'/'limited' (teto batido, envio recusado). Tratar o warning
// como bloqueio travava o composer em ~90%: o usuário via 94% e não conseguia
// mandar um prompt simples.
export function rateRejected(rate: RateInfo | null): boolean {
  return !!rate && rate.status !== 'allowed' && rate.status !== 'allowed_warning';
}

// Estado de cota derivado do teto do plano (janela de 5h) e do limite DURO do CLI.
//
// O limite duro pausa mesmo com fiveHour < 99.5 — senão a fila drenava e o prompt
// morria no limite (perdido). Na outra ponta, `resetsAt` vencido des-pausa NA HORA
// mesmo com o percentual do cliente stale ≥99.5: sem isso a fila só voltava no
// próximo push do servidor (até 60s) e o usuário precisava dar F5.
export function quotaGate(planUsage: PlanUsage | null, rate: RateInfo | null, now: number): QuotaGate {
  const rejected = rateRejected(rate);
  const planReset = planUsage?.resetsAt ?? null;
  const rateReset = rate?.resetsAt ?? null;
  const planExpired = planReset !== null && planReset <= now;
  const rateLimited = rejected && (!rateReset || rateReset > now);
  const paused = (!!planUsage && planUsage.fiveHour >= 99.5 && !planExpired) || rateLimited;
  // O reagendamento olha os dois tetos: o que vencer primeiro des-pausa a fila.
  const future = [planReset, rateReset].filter((n): n is number => n !== null && n > now);
  return {
    paused,
    warn: !!rate && rate.status !== 'allowed',
    resetsAt: planReset ?? rateReset,
    nextResetAt: future.length ? Math.min(...future) : null,
  };
}
