import { useState, useMemo, useEffect, useCallback } from 'react';
import type { GraphData, GraphNode } from '../../../shared/protocol';
import type { ColorMode } from './useForceGraph';
import type { RepoStat } from './GraphLegend';
import type { Neighbor } from './GraphNodeDetail';

// Estado + derivações da exploração de um grafo (cor, busca, foco de repo,
// seleção). GraphCanvas só compõe: chama isto + o motor useForceGraph e passa
// pros sub-componentes. Reseta tudo quando o grafo troca.
export function useGraphExplorer(graph: GraphData) {
  const hasRepos = useMemo(() => graph.nodes.some((n) => n.repo), [graph]);
  const [colorMode, setColorMode] = useState<ColorMode>(hasRepos ? 'repo' : 'community');
  const [query, setQuery] = useState('');
  const [focusRepo, setFocusRepo] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setColorMode(hasRepos ? 'repo' : 'community');
    setQuery(''); setFocusRepo(null); setSelectedId(undefined);
  }, [graph, hasRepos]);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const repos = useMemo<RepoStat[]>(() => {
    const counts = new Map<string, number>();
    for (const n of graph.nodes) if (n.repo) counts.set(n.repo, (counts.get(n.repo) ?? 0) + 1);
    return [...counts.entries()].map(([repo, count]) => ({ repo, count })).sort((a, b) => b.count - a.count);
  }, [graph]);

  const adjacency = useMemo(() => {
    const adj = new Map<string, Map<string, string>>(); // nó → (vizinho → relação)
    for (const e of graph.edges) {
      (adj.get(e.source) ?? adj.set(e.source, new Map()).get(e.source)!).set(e.target, e.relation);
      (adj.get(e.target) ?? adj.set(e.target, new Map()).get(e.target)!).set(e.source, e.relation);
    }
    return adj;
  }, [graph]);

  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;
  const neighbors = useMemo<Neighbor[]>(() => {
    if (!selectedId) return [];
    const rels = adjacency.get(selectedId);
    if (!rels) return [];
    return [...rels.entries()]
      .map(([id, relation]) => { const node = nodeById.get(id); return node ? { node, relation } : null; })
      .filter((n): n is Neighbor => !!n)
      .sort((a, b) => b.node.deg - a.node.deg).slice(0, 40);
  }, [selectedId, adjacency, nodeById]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? graph.nodes.filter((n) => n.label.toLowerCase().includes(q)) : []),
    [q, graph],
  );
  const matchCount = q ? matches.length : null;
  const firstMatchId = matches[0]?.id;

  const selectNode = useCallback((n: GraphNode) => setSelectedId(n.id), []);
  const clearSelection = useCallback(() => setSelectedId(undefined), []);

  return {
    colorMode, setColorMode, query, setQuery, focusRepo, setFocusRepo,
    selectedId, selectedNode, neighbors, selectNode, clearSelection,
    repos, hasRepos, matchCount, firstMatchId,
  };
}
