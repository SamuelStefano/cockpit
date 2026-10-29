import { describe, it, expect } from 'vitest';
import { hashStr, communityLayout } from './graph-layout';
import type { GraphNode } from '../../../shared/protocol';

function node(id: string, community: number): GraphNode {
  return { id, label: id, community, deg: 1 };
}

describe('hashStr', () => {
  it('é determinístico e varia entre ids diferentes', () => {
    expect(hashStr('a')).toBe(hashStr('a'));
    expect(hashStr('a')).not.toBe(hashStr('b'));
  });
});

describe('communityLayout', () => {
  it('é determinístico entre chamadas (mesmo grafo -> mesmas posições)', () => {
    const nodes = [node('a', 0), node('b', 0), node('c', 1)];
    const p1 = communityLayout(nodes);
    const p2 = communityLayout(nodes);
    expect(p1.get('a')).toEqual(p2.get('a'));
    expect(p1.get('c')).toEqual(p2.get('c'));
  });

  it('agrupa nós da mesma comunidade mais perto entre si que de outra comunidade', () => {
    const nodes = [
      ...Array.from({ length: 8 }, (_, i) => node(`c0-${i}`, 0)),
      ...Array.from({ length: 8 }, (_, i) => node(`c1-${i}`, 1)),
    ];
    const pos = communityLayout(nodes);
    const dist = (a: string, b: string) => {
      const pa = pos.get(a)!, pb = pos.get(b)!;
      return Math.hypot(pa.x - pb.x, pa.y - pb.y);
    };
    const withinC0 = dist('c0-0', 'c0-1');
    const acrossCommunities = dist('c0-0', 'c1-0');
    expect(withinC0).toBeLessThan(acrossCommunities);
  });

  it('cobre todos os nós recebidos', () => {
    const nodes = [node('x', 0), node('y', 5), node('z', 5)];
    const pos = communityLayout(nodes);
    expect(pos.size).toBe(3);
    for (const n of nodes) expect(pos.has(n.id)).toBe(true);
  });
});
