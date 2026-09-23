import { describe, it, expect } from 'vitest';
import type { CanvasGraph } from '../../shared/canvas';
import type { DflPointsSnapshot } from '../../shared/protocol';
import { cardAreaFromGraph, findDeliveryInSnapshot, findTaskInSnapshot } from './dfl-link';

describe('cardAreaFromGraph', () => {
  it('reads the area server/canvas/areas.ts already set on the card node', () => {
    const graph: CanvasGraph = { builtAt: 1, edges: [], nodes: [{ id: 'k:card1', kind: 'card', ref: 'card1', title: 't', subtitle: '', mtime: 1, area: 'dfl' }] };
    expect(cardAreaFromGraph(graph, 'card1')).toBe('dfl');
  });
  it('returns undefined for a card with no area (or not in the graph at all)', () => {
    const graph: CanvasGraph = { builtAt: 1, edges: [], nodes: [{ id: 'k:card1', kind: 'card', ref: 'card1', title: 't', subtitle: '', mtime: 1 }] };
    expect(cardAreaFromGraph(graph, 'card1')).toBeUndefined();
    expect(cardAreaFromGraph(graph, 'missing')).toBeUndefined();
  });
});

function snapshot(): DflPointsSnapshot {
  const task: import('../../shared/protocol').DflTaskNode = { id: 't1', name: 'Task 1', points: 3, status: 'todo', rawStatus: 'to_do', amountCents: 0 };
  return {
    projects: [{
      id: 'p1', name: 'Proj', points: 3, amountCents: 0,
      epics: [{
        id: 'e1', name: 'Epic', status: '', points: 3, amountCents: 0,
        deliveries: [{ id: 'd1', name: 'Delivery', status: '', pricePerPoint: 75, tasks: [task], points: 3, amountCents: 0 }],
      }],
    }],
    invoices: [], totals: { paidPoints: 0, paidAmountCents: 0, openPoints: 0, amountOpenCents: 0, todoPoints: 3, totalPoints: 3 },
    pricePerPoint: 75, syncedAt: 1, stale: false,
  };
}

describe('findTaskInSnapshot', () => {
  it('finds a task by walking the whole tree', () => {
    expect(findTaskInSnapshot(snapshot(), 't1')?.name).toBe('Task 1');
  });
  it('returns undefined for a task id not in the (owner-filtered) snapshot — never a live lookup', () => {
    expect(findTaskInSnapshot(snapshot(), 'not-mine')).toBeUndefined();
  });
});

describe('findDeliveryInSnapshot', () => {
  it('finds the delivery when epicId AND deliveryId both match the real pair', () => {
    expect(findDeliveryInSnapshot(snapshot(), 'e1', 'd1')?.name).toBe('Delivery');
  });
  it('rejects a real deliveryId paired with the WRONG epicId', () => {
    expect(findDeliveryInSnapshot(snapshot(), 'wrong-epic', 'd1')).toBeUndefined();
  });
  it('rejects an epicId that exists but has no such delivery', () => {
    expect(findDeliveryInSnapshot(snapshot(), 'e1', 'wrong-delivery')).toBeUndefined();
  });
});
