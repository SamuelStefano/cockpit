import { describe, it, expect } from 'vitest';
import { stepPhysics, MAX_SPEED, type Edge } from './graph-physics';
import type { GraphNode } from '../../../shared/protocol';
import type { Pt } from './graph-layout';

function setup() {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', community: 0, deg: 1 },
    { id: 'b', label: 'b', community: 0, deg: 1 },
  ];
  const edges: Edge[] = [{ source: 'a', target: 'b' }];
  const pos = new Map<string, Pt>([
    ['a', { x: -10, y: 0, vx: 0, vy: 0 }],
    ['b', { x: 10, y: 0, vx: 0, vy: 0 }],
  ]);
  return { nodes, edges, pos };
}

describe('stepPhysics', () => {
  it('é determinística (mesmo estado inicial → mesmas posições)', () => {
    const a = setup(), b = setup();
    for (let i = 0; i < 20; i++) { stepPhysics(a.nodes, a.edges, a.pos, undefined, 1); stepPhysics(b.nodes, b.edges, b.pos, undefined, 1); }
    expect(a.pos.get('a')).toEqual(b.pos.get('a'));
    expect(a.pos.get('b')).toEqual(b.pos.get('b'));
  });

  it('clampa a velocidade da repulsão em MAX_SPEED', () => {
    const { nodes, pos } = setup();
    // sem arestas: só repulsão+gravidade (o único termo que o clamp cobre). Nós
    // praticamente sobrepostos → repulsão enorme, mas a velocidade fica limitada.
    pos.set('a', { x: 0, y: 0, vx: 0, vy: 0 });
    pos.set('b', { x: 0.001, y: 0, vx: 0, vy: 0 });
    stepPhysics(nodes, [], pos, undefined, 1);
    for (const p of pos.values()) {
      expect(Math.abs(p.vx)).toBeLessThanOrEqual(MAX_SPEED);
      expect(Math.abs(p.vy)).toBeLessThanOrEqual(MAX_SPEED);
    }
  });

  it('não move o nó arrastado (pinado)', () => {
    const { nodes, edges, pos } = setup();
    const before = { ...pos.get('a')! };
    stepPhysics(nodes, edges, pos, 'a', 1);
    expect(pos.get('a')!.x).toBe(before.x);
    expect(pos.get('a')!.y).toBe(before.y);
  });

  it('não faz nada com lista de nós vazia', () => {
    const pos = new Map<string, Pt>();
    expect(() => stepPhysics([], [], pos, undefined, 1)).not.toThrow();
  });
});
