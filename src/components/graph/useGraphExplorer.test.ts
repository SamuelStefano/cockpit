// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGraphExplorer } from './useGraphExplorer';
import type { GraphData, GraphNode } from '../../../shared/protocol';

function node(id: string, over: Partial<GraphNode> = {}): GraphNode {
  return { id, label: id, community: 0, deg: 0, ...over };
}

function graph(over: Partial<GraphData> = {}): GraphData {
  return {
    directed: false, nodes: [], edges: [], communities: [],
    truncated: false, totalNodes: 0, totalEdges: 0, ...over,
  };
}

const G1 = graph({
  nodes: [
    node('a', { label: 'authorize', repo: 'x', deg: 3 }),
    node('b', { label: 'useCockpit', repo: 'x', deg: 1 }),
    node('c', { label: 'dispatch', repo: 'y', deg: 2 }),
  ],
  edges: [
    { source: 'a', target: 'b', relation: 'calls', confidence: 'EXTRACTED' },
    { source: 'a', target: 'c', relation: 'imports', confidence: 'EXTRACTED' },
  ],
});

describe('useGraphExplorer', () => {
  it('conta matches da busca (case-insensitive)', () => {
    const { result } = renderHook(() => useGraphExplorer(G1));
    expect(result.current.matchCount).toBeNull();
    act(() => result.current.setQuery('use'));
    expect(result.current.matchCount).toBe(1);
    act(() => result.current.setQuery('DISPATCH'));
    expect(result.current.matchCount).toBe(1);
  });

  it('deriva repos com contagem, ordenados desc', () => {
    const { result } = renderHook(() => useGraphExplorer(G1));
    expect(result.current.hasRepos).toBe(true);
    expect(result.current.repos[0]).toEqual({ repo: 'x', count: 2 });
    expect(result.current.colorMode).toBe('repo'); // default por-app quando há repos
  });

  it('lista vizinhos com relação, ordenados por grau', () => {
    const { result } = renderHook(() => useGraphExplorer(G1));
    act(() => result.current.selectNode(node('a')));
    const labels = result.current.neighbors.map((n) => n.node.label);
    expect(labels).toEqual(['dispatch', 'useCockpit']); // deg 2 antes de deg 1
    expect(result.current.neighbors[0].relation).toBe('imports');
  });

  it('reseta seleção/busca/foco ao trocar de grafo', () => {
    const { result, rerender } = renderHook(({ g }) => useGraphExplorer(g), { initialProps: { g: G1 } });
    act(() => { result.current.setQuery('auth'); result.current.selectNode(node('a')); });
    expect(result.current.selectedId).toBe('a');
    const G2 = graph({ nodes: [node('z')] });
    rerender({ g: G2 });
    expect(result.current.selectedId).toBeUndefined();
    expect(result.current.query).toBe('');
  });
});
