import { describe, it, expect } from 'vitest';
import type { DflProjectNode } from '../../../shared/protocol';
import { invoiceDraftsFromSelection } from './invoiceFromSelection';

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
