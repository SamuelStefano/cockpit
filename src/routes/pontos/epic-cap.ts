import type { DflEpicNode } from '../../../shared/protocol';
import { centsFromPoints } from './money';

// REGRA 1 (Samuel, 16/09/2026): um épico rende no MÁXIMO R$ 5.000. O que passa
// disso não some e não vira desconto — fica EM ESPERA, pra faturar quando a DFL
// puder pagar. Isso é independente do teto mensal (month-cap.ts): o mês pode ter
// dezenas de épicos somando muito mais que o teto; cada épico é que tem limite.
export const EPIC_CAP_CENTS = 500_000;

export type EpicCapState = 'ok' | 'held';

export interface EpicCap {
  paidCents: number;      // já faturado e pago neste épico (valor real do invoice)
  openCents: number;      // done e ainda não faturado, pelo valor do ponto vigente
  valueCents: number;     // paidCents + openCents: o que o épico já vale hoje
  billableCents: number;  // do aberto, quanto ainda cabe no teto do épico
  heldCents: number;      // do aberto, quanto passa do teto e fica em espera
  capCents: number;
  state: EpicCapState;
}

export interface EpicCapOptions {
  pointValue: number;
  excluded?: ReadonlySet<string>;  // deliveries marcadas como fora do recebível
  capCents?: number;
}

// PURA. O teto morde só o que AINDA pode ser faturado: um épico quitado há meses
// não vira "em espera" retroativamente, porque não há mais nada a segurar nele.
// Por isso o excedente sai do balde ABERTO (paid entra só na conta do que o épico
// já rendeu). Delivery excluída do recebível já está em espera por decisão manual
// e não entra no cálculo.
export function epicCap(epic: DflEpicNode, opts: EpicCapOptions): EpicCap {
  const capCents = opts.capCents ?? EPIC_CAP_CENTS;
  let paidCents = 0;
  let openPoints = 0;
  for (const d of epic.deliveries) {
    if (opts.excluded?.has(d.id)) continue;
    for (const t of d.tasks) {
      if (t.status === 'paid') paidCents += t.amountCents;
      else if (t.status === 'open') openPoints += t.points;
    }
  }
  const openCents = centsFromPoints(openPoints, opts.pointValue);
  const valueCents = paidCents + openCents;
  const heldCents = Math.min(openCents, Math.max(0, valueCents - capCents));
  return {
    paidCents,
    openCents,
    valueCents,
    billableCents: openCents - heldCents,
    heldCents,
    capCents,
    state: heldCents > 0 ? 'held' : 'ok',
  };
}

export function epicCapDetail(cap: EpicCap, brl: (cents: number) => string): string {
  if (cap.state === 'ok') {
    return `${brl(cap.valueCents)} de ${brl(cap.capCents)} — cabe inteiro no teto do épico.`;
  }
  return `Passa ${brl(cap.heldCents)} do teto de ${brl(cap.capCents)}. Fatura ${brl(cap.billableCents)} agora; o resto espera o Tainan poder pagar.`;
}
