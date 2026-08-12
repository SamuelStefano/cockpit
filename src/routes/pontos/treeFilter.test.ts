import { describe, it, expect } from 'vitest';
import type { DflProjectNode, DflDeliveryNode } from '../../../shared/protocol';
import { filterProjects, deliveryCounts, redundantEpicHeader } from './treeFilter';

function task(id: string, status: 'paid' | 'open' | 'todo') {
  return { id, name: id, points: 1, status, rawStatus: 'done', amountCents: 100 };
}
function proj(): DflProjectNode {
  return {
    id: 'p1', name: 'P', points: 3, amountCents: 300,
    epics: [{
      id: 'e1', name: 'E', status: 'active', points: 3, amountCents: 300,
      deliveries: [
        { id: 'd1', name: 'D1', status: 'open', pricePerPoint: 75, points: 2, amountCents: 200, tasks: [task('t1', 'paid'), task('t2', 'open')] },
        { id: 'd2', name: 'D2', status: 'open', pricePerPoint: 75, points: 1, amountCents: 100, tasks: [task('t3', 'todo')] },
      ],
    }],
  };
}

describe('filterProjects', () => {
  it('all devolve a mesma referência', () => {
    const ps = [proj()];
    expect(filterProjects(ps, 'all')).toBe(ps);
  });
  it('filtra tasks e poda deliveries vazias', () => {
    const out = filterProjects([proj()], 'paid');
    expect(out).toHaveLength(1);
    expect(out[0].epics[0].deliveries).toHaveLength(1);
    expect(out[0].epics[0].deliveries[0].tasks.map((t) => t.id)).toEqual(['t1']);
  });
  it('poda projeto inteiro sem match', () => {
    const p = proj();
    p.epics[0].deliveries.forEach((d) => (d.tasks = d.tasks.filter((t) => t.status !== 'todo')));
    expect(filterProjects([p], 'todo')).toHaveLength(0);
  });
});

describe('redundantEpicHeader', () => {
  const ep = (name: string, deliveries: string[]) => ({
    id: 'e', name, status: 'active', points: 1, amountCents: 100,
    deliveries: deliveries.map((n, i) => ({ id: `d${i}`, name: n, status: 'open', pricePerPoint: 75, points: 1, amountCents: 100, tasks: [] })),
  });
  it('1 delivery com nome ~igual é redundante', () => {
    expect(redundantEpicHeader(ep('Samuel - Revenue/Fiscal - JUN', ['Samuel - Revenue/Fiscal - JUN // Samuel']))).toBe(true);
  });
  it('nomes distintos ou 2+ deliveries mantêm o header', () => {
    expect(redundantEpicHeader(ep('Epic A', ['Delivery B']))).toBe(false);
    expect(redundantEpicHeader(ep('X', ['X // a', 'X // b']))).toBe(false);
  });
});

describe('deliveryCounts', () => {
  it('conta por status', () => {
    const d = proj().epics[0].deliveries[0] as DflDeliveryNode;
    expect(deliveryCounts(d)).toEqual({ paid: 1, open: 1, todo: 0 });
  });
});
