import { describe, it, expect } from 'vitest';
import type { DflProjectNode } from '../../../shared/protocol';
import { invoiceDraftsFromSelection, selectionSummary } from './invoiceFromSelection';
import { MONTH_RE } from './InvoiceConfirmModal';

function project(overrides: Partial<DflProjectNode> = {}): DflProjectNode {
  return {
    id: 'p1', name: 'Proj', points: 0, amountCents: 0,
    epics: [{
      id: 'e1', name: 'Epic', status: 'active', points: 0, amountCents: 0,
      deliveries: [{
        id: 'd1', name: 'Delivery', status: 'active', pricePerPoint: 75, tasks: [
          { id: 't1', name: 'A', points: 3, status: 'open', rawStatus: 'done', amountCents: 22500 },
          { id: 't2', name: 'B', points: 2, status: 'paid', rawStatus: 'done', amountCents: 15000 },
          { id: 't3', name: 'C', points: 5, status: 'todo', rawStatus: 'to_do', amountCents: 37500 },
        ],
        points: 10, amountCents: 75000,
      }],
    }],
    ...overrides,
  };
}

describe('invoiceDraftsFromSelection', () => {
  it('inclui só tasks em aberto e computa points/amount da delivery selecionada', () => {
    const drafts = invoiceDraftsFromSelection([project()], new Set(['d1']), '2026-07');
    expect(drafts).toHaveLength(1);
    const d = drafts[0];
    expect(d.tasks.map((t) => t.id)).toEqual(['t1']);
    expect(d.points).toBe(3);
    expect(d.amountCents).toBe(22500);
    expect(d.projectId).toBe('p1');
    expect(d.referenceMonth).toBe('2026-07');
  });

  it('descarta delivery sem task aberta', () => {
    const p = project();
    p.epics[0].deliveries[0].tasks = [{ id: 't2', name: 'B', points: 2, status: 'paid', rawStatus: 'done', amountCents: 15000 }];
    expect(invoiceDraftsFromSelection([p], new Set(['d1']), '2026-07')).toHaveLength(0);
  });

  it('ignora deliveries não selecionadas', () => {
    expect(invoiceDraftsFromSelection([project()], new Set(['zzz']), '2026-07')).toHaveLength(0);
  });
});

describe('selectionSummary', () => {
  it('shows what the invoice will bill: open tasks only, not the whole delivery', () => {
    // Delivery has 10 pt in total (3 open, 2 paid, 5 to-do); the invoice bills 3.
    expect(selectionSummary([project()], new Set(['d1']))).toEqual({ count: 1, billable: 1, off: 0, points: 3, amountCents: 22500 });
  });

  it('never bills a delivery marked off', () => {
    expect(selectionSummary([project()], new Set(['d1']), new Set(['d1']))).toMatchObject({ count: 1, billable: 0, off: 1, points: 0 });
    expect(invoiceDraftsFromSelection([project()], new Set(['d1']), '2026-07', new Set(['d1']))).toHaveLength(0);
  });

  it('counts a selected delivery with nothing open as not billable', () => {
    const p = project();
    p.epics[0].deliveries[0].tasks = [{ id: 't2', name: 'B', points: 2, status: 'paid', rawStatus: 'done', amountCents: 15000 }];
    expect(selectionSummary([p], new Set(['d1']))).toMatchObject({ count: 1, billable: 0, points: 0 });
  });
});

describe('MONTH_RE', () => {
  it('accepts only months 01-12', () => {
    expect(MONTH_RE.test('2026-07')).toBe(true);
    expect(MONTH_RE.test('2026-12')).toBe(true);
    for (const bad of ['2026-13', '2026-00', '2026-7', '07/2026']) expect(MONTH_RE.test(bad)).toBe(false);
  });
});
