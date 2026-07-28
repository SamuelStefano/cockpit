import type { PlanUsage } from '../../shared/protocol';
import { getRateSnapshot, type RateSnapshot } from './rate';
import { getLastPlanUsage, requestPlanUsageRefresh } from './usage-plan';

// Teto de tokens do plano: enquanto vale, NENHUMA fila drena. Sem este gate o
// drainer disparava o prompt estacionado contra uma sessão sem token — o turno
// morria no limite e o item já tinha saído do parked.json (prompt queimado).

// Status do CLI que ainda permite enviar; qualquer outro é teto batido de verdade.
const ALLOWED = new Set(['allowed', 'allowed_warning']);
// Mesmo corte que o cliente usa pra pausar o composer (App.tsx).
export const PLAN_FULL_PCT = 99.5;
// rate_limit_event sem resetsAt: segura por uma janela curta, não pra sempre — um
// hold eterno deixaria a fila parada a noite toda (o oposto do bug que ela resolve).
export const UNKNOWN_HOLD_MS = 30 * 60_000;

// Epoch ms até quando a fila deve segurar; 0 = livre pra drenar.
export function quotaHoldUntil(rate: RateSnapshot | null, usage: PlanUsage | null, now: number): number {
  let until = 0;
  if (rate && !ALLOWED.has(rate.status)) {
    const t = rate.resetsAt > 0 ? rate.resetsAt : rate.setAt + UNKNOWN_HOLD_MS;
    if (t > now) until = Math.max(until, t);
  }
  // A utilização só segura com reset FUTURO conhecido: o poll de usage pausa sem
  // browser aberto, e um número stale em 100% travaria a fila indefinidamente.
  if (usage && usage.fiveHour >= PLAN_FULL_PCT && usage.resetsAt && usage.resetsAt > now) {
    until = Math.max(until, usage.resetsAt);
  }
  return until;
}

// Hold ao vivo (sinais em memória do agente). Enquanto segura, pede um refresh do
// usage pra soltar a fila assim que a janela virar, sem esperar o poll de 60s.
export function quotaHold(now = Date.now()): number {
  const until = quotaHoldUntil(getRateSnapshot(), getLastPlanUsage(), now);
  if (until) requestPlanUsageRefresh();
  return until;
}

const QUOTA_TEXT = /usage limit|limit reached|out of (tokens|credits)|limite de uso|sem tokens|tokens esgotad/i;

// O turno que subiu da fila morreu no teto sem produzir nada? Então o prompt não
// foi consumido e volta pra fila. Nunca devolve um turno que rodou tools ou
// respondeu de verdade — reenviar aquilo duplicaria trabalho já feito.
export function burnedByQuota(a: { limited: boolean; tools: number; text: string }): boolean {
  if (!a.limited) return false;
  if (QUOTA_TEXT.test(a.text)) return true;
  return a.tools === 0 && a.text.trim() === '';
}
