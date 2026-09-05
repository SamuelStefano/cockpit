import type { PlanUsage, PlanLimit } from '../../../shared/protocol';

export type UsageTone = 'ok' | 'mid' | 'high';

// A cor sai do MAIOR entre o que a Anthropic classificou e o que a porcentagem
// diz: um teto pode estar em 76% e vir como `warning`, mas se vier `normal` a
// barra ainda precisa avisar.
export function toneOf(pct: number, severity: PlanLimit['severity'] = 'normal'): UsageTone {
  if (severity === 'critical' || pct >= 90) return 'high';
  if (severity === 'warning' || pct >= 70) return 'mid';
  return 'ok';
}

// Snapshot cuja janela de 5h já virou é do ciclo ANTERIOR: o percentual de lá não
// descreve mais nada. Enquanto o poll não traz o novo (o endpoint de usage vive
// 429 e o bloqueio dura minutos), a barra assume que não sabe — "0%" com
// convicção é pior que "—", porque some com o único sinal de que algo travou.
export function isStalePlanUsage(usage: PlanUsage | null, now = Date.now()): boolean {
  return !!usage?.resetsAt && usage.resetsAt <= now;
}

export interface UsageRow {
  id: string;
  label: string;
  pct: number;
  resetsAt: number | null;
  tone: UsageTone;
  scoped: boolean;
}

// A conta manda `limits[]` com um item por teto — inclusive os escopados por
// modelo, que não existem em lugar nenhum fora dessa lista. Quando ela vem
// vazia caímos nos dois números soltos, pra o painel nunca abrir vazio. O front
// (Vercel) sobe antes do backend, então `limits` chega ausente até o servidor
// atualizar — sem o `?.` a tela inteira quebra nessa janela.
export function usageRows(usage: PlanUsage | null): UsageRow[] {
  if (!usage) return [];
  if (usage.limits?.length) {
    return usage.limits.map((l) => ({
      id: l.id,
      label: l.label,
      pct: l.pct,
      resetsAt: l.resetsAt,
      tone: toneOf(l.pct, l.severity),
      scoped: l.scoped,
    }));
  }
  return [
    { id: 'five-hour', label: 'Sessão (5h)', pct: usage.fiveHour, resetsAt: usage.resetsAt, tone: toneOf(usage.fiveHour), scoped: false },
    { id: 'seven-day', label: 'Semanal', pct: usage.sevenDay, resetsAt: usage.sevenDayResetsAt, tone: toneOf(usage.sevenDay), scoped: false },
  ];
}
