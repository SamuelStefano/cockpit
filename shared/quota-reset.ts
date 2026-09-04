import type { PlanUsage } from './protocol';

// Presets de "agendar pro próximo reset de cota". Nasceu do problema que motiva o
// agendamento: o trabalho para porque a janela acabou, e retomar exigia o usuário
// converter o epoch do plan-usage na mão pra preencher o campo de data.

// Margem depois do reset. A cota vira no instante exato do `resetsAt`, e disparar
// junto competia com o dreno da fila (que também acorda na virada) pela mesma janela
// recém-aberta. Um minuto depois o estado já estabilizou.
export const RESET_MARGIN_MS = 60_000;

export type ResetWindow = 'fiveHour' | 'sevenDay';

export interface ResetPreset {
  window: ResetWindow;
  label: string;
  atMs: number;
}

// Instante em que o preset deve disparar, ou null se o snapshot não sabe quando a
// janela vira. `resetsAt` no passado = leitura velha (o poll de usage pausa sem
// browser aberto): agendar pra trás nunca dispararia, então é melhor não oferecer.
export function resetAtMs(usage: PlanUsage | null, window: ResetWindow, now: number): number | null {
  if (!usage) return null;
  const raw = window === 'fiveHour' ? usage.resetsAt : usage.sevenDayResetsAt;
  if (!raw || !Number.isFinite(raw)) return null;
  // Compara o valor CRU, não o já somado à margem: um reset que acabou de passar
  // ficaria "no futuro" só por causa da margem e agendaria pra daqui a um minuto —
  // que não é o próximo reset, é agora.
  if (raw <= now) return null;
  return raw + RESET_MARGIN_MS;
}

function humanDelta(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `em ${min}min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  if (h < 24) return rest ? `em ${h}h${String(rest).padStart(2, '0')}` : `em ${h}h`;
  return `em ${Math.round(h / 24)}d`;
}

// Presets oferecíveis agora. Só entra a janela cujo reset é conhecido e futuro — um
// botão que agenda pro passado é pior que botão nenhum.
export function resetPresets(usage: PlanUsage | null, now: number): ResetPreset[] {
  const out: ResetPreset[] = [];
  const five = resetAtMs(usage, 'fiveHour', now);
  if (five !== null) out.push({ window: 'fiveHour', label: `Próximo reset de 5h (${humanDelta(five - now)})`, atMs: five });
  const week = resetAtMs(usage, 'sevenDay', now);
  if (week !== null) out.push({ window: 'sevenDay', label: `Próximo reset semanal (${humanDelta(week - now)})`, atMs: week });
  return out;
}
