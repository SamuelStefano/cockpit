import { describe, it, expect } from 'vitest';
import type { CanvasGraph, CanvasNode } from '../../shared/canvas';
import type { DflPointsSnapshot } from '../../shared/protocol';
import { cardLinksAreUnanimouslyDfl, findDeliveryInSnapshot, findTaskInSnapshot } from './dfl-link';

const node = (over: Partial<CanvasNode> & { id: string; kind: CanvasNode['kind'] }): CanvasNode => ({ ref: over.id, title: 't', subtitle: '', mtime: 1, ...over });

describe('cardLinksAreUnanimouslyDfl', () => {
  it('true when every linked context/session is dfl', () => {
    const graph: CanvasGraph = {
      builtAt: 1,
      nodes: [node({ id: 'k:c1', kind: 'card' }), node({ id: 'c:x', kind: 'context', area: 'dfl' }), node({ id: 's:y', kind: 'session', area: 'dfl' })],
      edges: [{ source: 'k:c1', target: 'c:x', kind: 'card' }, { source: 'k:c1', target: 's:y', kind: 'input' }],
    };
    expect(cardLinksAreUnanimouslyDfl(graph, 'c1')).toBe(true);
  });

  it('false when even ONE linked node is not dfl — a majority-dfl card must never pass', () => {
    const graph: CanvasGraph = {
      builtAt: 1,
      nodes: [node({ id: 'k:c1', kind: 'card' }), node({ id: 'c:x', kind: 'context', area: 'dfl' }), node({ id: 'c:y', kind: 'context', area: 'dfl' }), node({ id: 'c:z', kind: 'context', area: 'pessoal' })],
      edges: [
        { source: 'k:c1', target: 'c:x', kind: 'card' }, { source: 'k:c1', target: 'c:y', kind: 'card' },
        { source: 'k:c1', target: 'c:z', kind: 'card' },
      ],
    };
    expect(cardLinksAreUnanimouslyDfl(graph, 'c1')).toBe(false);
  });

  it('false for a card with nothing linked (fail closed, not "no evidence so sure")', () => {
    const graph: CanvasGraph = { builtAt: 1, nodes: [node({ id: 'k:c1', kind: 'card' })], edges: [] };
    expect(cardLinksAreUnanimouslyDfl(graph, 'c1')).toBe(false);
  });

  it('false for a card not in the graph at all', () => {
    const graph: CanvasGraph = { builtAt: 1, nodes: [], edges: [] };
    expect(cardLinksAreUnanimouslyDfl(graph, 'missing')).toBe(false);
  });

  it('a linked node with no area at all also fails the check', () => {
    const graph: CanvasGraph = {
      builtAt: 1,
      nodes: [node({ id: 'k:c1', kind: 'card' }), node({ id: 'c:x', kind: 'context' })],
      edges: [{ source: 'k:c1', target: 'c:x', kind: 'card' }],
    };
    expect(cardLinksAreUnanimouslyDfl(graph, 'c1')).toBe(false);
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
