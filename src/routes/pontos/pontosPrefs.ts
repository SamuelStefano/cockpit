import type { DflProjectNode, DflTotals } from '../../../shared/protocol';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface RecomputedTotals {
  totals: DflTotals;
  offPoints: number;
  offAmountCents: number;
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
