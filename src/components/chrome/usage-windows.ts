import type { PlanWindowKey } from '../../../shared/protocol';

// Rótulos das janelas de limite da conta. Mesmos escopos que o claude.ai mostra
// em Settings → Usage, em português e encurtados pro popover.
const LABELS: Record<PlanWindowKey, string> = {
  five_hour: 'Sessão · 5h',
  seven_day: 'Semana',
  seven_day_opus: 'Semana · Opus',
  seven_day_sonnet: 'Semana · Sonnet',
  overage: 'Excedente pago',
};

export function windowLabel(key: PlanWindowKey): string {
  return LABELS[key];
}

export type UsageTone = 'green' | 'yellow' | 'red';

// Faixas do indicador: verde folgado, âmbar quando já passou de 70% e vermelho
// perto do teto — a partir daí o turno pode ser barrado por quota a qualquer hora.
export function usageTone(pct: number): UsageTone {
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'yellow';
  return 'green';
}

export const toneText: Record<UsageTone, string> = {
  green: 'text-emerald-300',
  yellow: 'text-amber-300',
  red: 'text-red-300',
};
