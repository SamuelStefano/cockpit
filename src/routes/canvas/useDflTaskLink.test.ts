import { describe, it, expect } from 'vitest';
import type { DflPointsSnapshot } from '../../../shared/protocol';
import { flattenDflDeliveries, flattenDflTasks, searchDflTasks } from './useDflTaskLink';

function snapshot(): DflPointsSnapshot {
  return {
    projects: [{
      id: 'p1', name: 'Proj', points: 0, amountCents: 0,
      epics: [{
        id: 'e1', name: 'Epic', status: '', points: 0, amountCents: 0,
        deliveries: [{
          id: 'd1', name: 'Delivery', status: '', pricePerPoint: 75, points: 0, amountCents: 0,
          tasks: [{ id: 't1', name: 'Task 1', points: 1, status: 'todo', rawStatus: 'to_do', amountCents: 0 }],
        }],
      }],
    }],
    invoices: [], totals: { paidPoints: 0, paidAmountCents: 0, openPoints: 0, amountOpenCents: 0, todoPoints: 0, totalPoints: 0 },
    pricePerPoint: 75, syncedAt: 1, stale: false,
  };
}

describe('flattenDflTasks', () => {
  it('flattens the project›epic›delivery›task tree into a searchable list', () => {
    expect(flattenDflTasks(snapshot())).toEqual([
      { id: 't1', name: 'Task 1', deliveryName: 'Delivery', epicName: 'Epic', projectName: 'Proj' },
    ]);
  });
  it('an absent snapshot (sync never ran) flattens to an empty list, not a crash', () => {
    expect(flattenDflTasks(null)).toEqual([]);
  });
});

describe('flattenDflDeliveries', () => {
  it('flattens deliveries with a breadcrumb label, keeping the epicId+deliveryId pair', () => {
    expect(flattenDflDeliveries(snapshot())).toEqual([{ epicId: 'e1', deliveryId: 'd1', label: 'Proj / Epic / Delivery' }]);
  });
  it('an absent snapshot flattens to an empty list', () => {
    expect(flattenDflDeliveries(null)).toEqual([]);
  });
});

describe('searchDflTasks', () => {
  const tasks = [
    { id: 'a', name: 'Checkout', deliveryName: 'Pagamentos', epicName: 'Integração Woovi', projectName: 'DFL' },
    { id: 'b', name: 'Player seek', deliveryName: 'Vídeo', epicName: 'Itera Player', projectName: 'Itera' },
  ];
  it('matches the delivery, epic and project too, every word, ignoring accents', () => {
    expect(searchDflTasks(tasks, 'itera').map((t) => t.id)).toEqual(['b']);
    expect(searchDflTasks(tasks, 'integracao checkout').map((t) => t.id)).toEqual(['a']);
    expect(searchDflTasks(tasks, 'pagamento video')).toEqual([]);
  });
  it('lists the first ones on an empty query', () => {
    expect(searchDflTasks(tasks, '  ', 1).map((t) => t.id)).toEqual(['a']);
  });
});

describe('searchDflTasks ranking', () => {
  it('puts tasks named after the query before tasks that only live under it', () => {
    const under = Array.from({ length: 9 }, (_, i) => ({ id: `u${i}`, name: `Seek ${i}`, deliveryName: 'Vídeo', epicName: 'Player', projectName: 'Itera' }));
    const named = { id: 'n', name: 'Itera onboarding', deliveryName: 'Docs', epicName: 'Geral', projectName: 'DFL' };
    expect(searchDflTasks([...under, named], 'itera')[0].id).toBe('n');
  });
});
