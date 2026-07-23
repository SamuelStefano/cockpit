import { describe, it, expect } from 'vitest';
import { recomputeTotals, sumDeliveries } from './pontosPrefs';
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
    const r = recomputeTotals(tree(), new Set(), 75);
    expect(r.totals.openPoints).toBe(9);
    expect(r.totals.amountOpenCents).toBe(67500);
    expect(r.totals.paidPoints).toBe(3);
    expect(r.totals.todoPoints).toBe(2);
    expect(r.offPoints).toBe(0);
  });

  it('delivery off sai do "em aberto" e vira balde off; paid/todo intactos', () => {
    const r = recomputeTotals(tree(), new Set(['d-audit']), 75);
    expect(r.totals.openPoints).toBe(4);
    expect(r.totals.amountOpenCents).toBe(30000);
    expect(r.offPoints).toBe(5);
    expect(r.offAmountCents).toBe(37500);
    expect(r.totals.paidPoints).toBe(3);
    expect(r.totals.todoPoints).toBe(2);
    expect(r.totals.totalPoints).toBe(9);
  });

  it('valor do ponto recalcula aberto/off; paid mantém o faturado real', () => {
    const r = recomputeTotals(tree(), new Set(['d-audit']), 80);
    expect(r.totals.amountOpenCents).toBe(32000); // 4 pts × R$80
    expect(r.offAmountCents).toBe(40000);         // 5 pts × R$80
    expect(r.totals.paidAmountCents).toBe(22500); // histórico não muda
  });
});

describe('sumDeliveries', () => {
  const projects: DflProjectNode[] = [{
    id: 'p', name: 'P', points: 0, amountCents: 0,
    epics: [{ id: 'e', name: 'E', status: '', points: 0, amountCents: 0, deliveries: [
      { id: 'a', name: 'A', status: '', pricePerPoint: 75, points: 4, amountCents: 30000, tasks: [] },
      { id: 'b', name: 'B', status: '', pricePerPoint: 75, points: 5, amountCents: 37500, tasks: [] },
      { id: 'c', name: 'C', status: '', pricePerPoint: 75, points: 2, amountCents: 15000, tasks: [] },
    ] }],
  }];

  it('soma só as selecionadas (valor = pontos × valor do ponto)', () => {
    const s = sumDeliveries(projects, new Set(['a', 'b']), 75);
    expect(s).toEqual({ count: 2, points: 9, amountCents: 67500 });
  });

  it('valor do ponto muda o total da seleção', () => {
    const s = sumDeliveries(projects, new Set(['a', 'b']), 100);
    expect(s).toEqual({ count: 2, points: 9, amountCents: 90000 });
  });

  it('vazio quando nada selecionado', () => {
    expect(sumDeliveries(projects, new Set(), 75)).toEqual({ count: 0, points: 0, amountCents: 0 });
  });
});
