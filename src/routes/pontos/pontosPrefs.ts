import type { DflProjectNode, DflTotals } from '../../../shared/protocol';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface RecomputedTotals {
  totals: DflTotals;
  offPoints: number;
  offAmountCents: number;
}

export interface DeliverySum {
  count: number;
  points: number;
  amountCents: number;
}

// Soma pontos/valor das deliveries selecionadas (pra barra de seleção → gerar invoice).
export function sumDeliveries(projects: DflProjectNode[], selected: Set<string>): DeliverySum {
  let count = 0, points = 0, amountCents = 0;
  for (const p of projects) {
    for (const e of p.epics) {
      for (const d of e.deliveries) {
        if (!selected.has(d.id)) continue;
        count++; points += d.points; amountCents += d.amountCents;
      }
    }
  }
  return { count, points: round2(points), amountCents };
}

// Recalcula os totais a partir da árvore, tirando do "em aberto" as deliveries
// marcadas como fora do recebível (trabalho feito, mas que ainda não pode ser
// faturado — ex: auditoria de segurança). O que sai vira o balde "off", exibido à
// parte; paid/todo não mudam.
export function recomputeTotals(projects: DflProjectNode[], excluded: Set<string>): RecomputedTotals {
  let paidPoints = 0, paidAmountCents = 0, openPoints = 0, amountOpenCents = 0, todoPoints = 0;
  let offPoints = 0, offAmountCents = 0;
  for (const p of projects) {
    for (const e of p.epics) {
      for (const d of e.deliveries) {
        const off = excluded.has(d.id);
        for (const t of d.tasks) {
          if (t.status === 'paid') { paidPoints += t.points; paidAmountCents += t.amountCents; }
          else if (t.status === 'open') {
            if (off) { offPoints += t.points; offAmountCents += t.amountCents; }
            else { openPoints += t.points; amountOpenCents += t.amountCents; }
          } else { todoPoints += t.points; }
        }
      }
    }
  }
  return {
    totals: {
      paidPoints: round2(paidPoints), paidAmountCents,
      openPoints: round2(openPoints), amountOpenCents,
      todoPoints: round2(todoPoints),
      totalPoints: round2(paidPoints + openPoints + todoPoints),
    },
    offPoints: round2(offPoints),
    offAmountCents,
  };
}
