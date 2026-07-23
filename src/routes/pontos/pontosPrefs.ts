import type { DflProjectNode, DflTotals } from '../../../shared/protocol';
import { centsFromPoints } from './money';

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

// Soma pontos/valor das deliveries selecionadas (pra barra de seleção → gerar
// invoice). Valor = pontos × valor do ponto vigente (recalcula quando o usuário
// troca o valor na UI).
export function sumDeliveries(projects: DflProjectNode[], selected: Set<string>, pointValue: number): DeliverySum {
  let count = 0, points = 0;
  for (const p of projects) {
    for (const e of p.epics) {
      for (const d of e.deliveries) {
        if (!selected.has(d.id)) continue;
        count++; points += d.points;
      }
    }
  }
  const pts = round2(points);
  return { count, points: pts, amountCents: centsFromPoints(pts, pointValue) };
}

// Recalcula os totais a partir da árvore, tirando do "em aberto" as deliveries
// marcadas como fora do recebível (trabalho feito, mas que ainda não pode ser
// faturado — ex: auditoria de segurança). O que sai vira o balde "off", exibido à
// parte; paid/todo não mudam. O recebível (aberto/off) usa o valor do ponto
// vigente; `paid` mantém o valor real já faturado (histórico não recalcula).
export function recomputeTotals(projects: DflProjectNode[], excluded: Set<string>, pointValue: number): RecomputedTotals {
  let paidPoints = 0, paidAmountCents = 0, openPoints = 0, todoPoints = 0, offPoints = 0;
  for (const p of projects) {
    for (const e of p.epics) {
      for (const d of e.deliveries) {
        const off = excluded.has(d.id);
        for (const t of d.tasks) {
          if (t.status === 'paid') { paidPoints += t.points; paidAmountCents += t.amountCents; }
          else if (t.status === 'open') {
            if (off) offPoints += t.points; else openPoints += t.points;
          } else { todoPoints += t.points; }
        }
      }
    }
  }
  const open2 = round2(openPoints), off2 = round2(offPoints);
  return {
    totals: {
      paidPoints: round2(paidPoints), paidAmountCents,
      openPoints: open2, amountOpenCents: centsFromPoints(open2, pointValue),
      todoPoints: round2(todoPoints),
      totalPoints: round2(paidPoints + openPoints + todoPoints),
    },
    offPoints: off2,
    offAmountCents: centsFromPoints(off2, pointValue),
  };
}
