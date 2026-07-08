import { useState, useMemo, useEffect, useCallback } from 'react';
import type { GraphData, GraphNode } from '../../../shared/protocol';
import type { ColorMode } from './useForceGraph';
import type { RepoStat } from './GraphLegend';

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
    const adj = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      (adj.get(e.source) ?? adj.set(e.source, new Set()).get(e.source)!).add(e.target);
      (adj.get(e.target) ?? adj.set(e.target, new Set()).get(e.target)!).add(e.source);
    }
    return adj;
  }, [graph]);

  const selectedNode = selectedId ? nodeById.get(selectedId) ?? null : null;
  const neighbors = useMemo<GraphNode[]>(() => {
    if (!selectedId) return [];
    const ids = adjacency.get(selectedId);
    if (!ids) return [];
    return [...ids].map((id) => nodeById.get(id)).filter((n): n is GraphNode => !!n)
      .sort((a, b) => b.deg - a.deg).slice(0, 40);
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
