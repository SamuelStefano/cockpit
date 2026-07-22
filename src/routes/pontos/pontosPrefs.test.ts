import { describe, it, expect } from 'vitest';
import { recomputeTotals } from './pontosPrefs';
import type { DflProjectNode } from '../../../shared/protocol';

function tree(): DflProjectNode[] {
  return [{
    id: 'p1', name: 'P', points: 0, amountCents: 0,
    epics: [{
      id: 'e1', name: 'E', status: '', points: 0, amountCents: 0,
      deliveries: [
        { id: 'd-open', name: 'Aberta', status: '', pricePerPoint: 75, points: 0, amountCents: 0, tasks: [
          { id: 't1', name: 'a', points: 4, status: 'open', rawStatus: 'done', amountCents: 30000 },
          { id: 't2', name: 'b', points: 2, status: 'todo', rawStatus: 'to_do', amountCents: 15000 },
        ] },
        { id: 'd-audit', name: 'Auditoria', status: '', pricePerPoint: 75, points: 0, amountCents: 0, tasks: [
          { id: 't3', name: 'c', points: 5, status: 'open', rawStatus: 'done', amountCents: 37500 },
        ] },
        { id: 'd-paid', name: 'Paga', status: '', pricePerPoint: 75, points: 0, amountCents: 0, tasks: [
          { id: 't4', name: 'd', points: 3, status: 'paid', rawStatus: 'done', amountCents: 22500 },
        ] },
      ],
    }],
  }];
}

describe('recomputeTotals', () => {
  it('sem exclusões espelha a árvore (open soma todas as done não faturadas)', () => {
    const r = recomputeTotals(tree(), new Set());
    expect(r.totals.openPoints).toBe(9);
    expect(r.totals.amountOpenCents).toBe(67500);
    expect(r.totals.paidPoints).toBe(3);
    expect(r.totals.todoPoints).toBe(2);
    expect(r.offPoints).toBe(0);
  });

  it('delivery off sai do "em aberto" e vira balde off; paid/todo intactos', () => {
    const r = recomputeTotals(tree(), new Set(['d-audit']));
    expect(r.totals.openPoints).toBe(4);
    expect(r.totals.amountOpenCents).toBe(30000);
    expect(r.offPoints).toBe(5);
    expect(r.offAmountCents).toBe(37500);
    expect(r.totals.paidPoints).toBe(3);
    expect(r.totals.todoPoints).toBe(2);
    expect(r.totals.totalPoints).toBe(9);
  });
});
