import { describe, it, expect } from 'vitest';
import { projectGraph, nameCommunity } from './graph';
import type { GraphNode } from '../shared/protocol';

function node(id: string, over: Partial<GraphNode> = {}): GraphNode {
  return { id, label: id, community: 0, deg: 0, ...over };
}

describe('nameCommunity', () => {
  it('usa o diretório dominante (2 primeiros segmentos)', () => {
    const members = [
      node('a', { file: 'server/ws/dispatch.ts' }),
      node('b', { file: 'server/ws/runs.ts' }),
      node('c', { file: 'src/App.tsx' }),
    ];
    expect(nameCommunity(members)).toBe('server/ws');
  });

  it('desempata pelo alfabeticamente menor', () => {
    const members = [
      node('a', { file: 'src/a/x.ts' }),
      node('b', { file: 'src/b/y.ts' }),
    ];
    expect(nameCommunity(members)).toBe('src/a');
  });

  it('prefixa o repo dominante no grafo global', () => {
    const members = [
      node('a', { file: 'server/ws/x.ts', repo: 'cockpit' }),
      node('b', { file: 'server/ws/y.ts', repo: 'cockpit' }),
    ];
    expect(nameCommunity(members)).toBe('cockpit · server/ws');
  });

  it('retorna vazio quando não há arquivos (caller cai em "comunidade N")', () => {
    expect(nameCommunity([node('a'), node('b')])).toBe('');
  });

  it('ignora caminhos absolutos (cross-repo) ao nomear', () => {
    const members = [
      node('a', { file: '/home/samuel/x/y.ts' }),
      node('b', { file: 'lib/util.ts' }),
    ];
    expect(nameCommunity(members)).toBe('lib');
  });
});

describe('projectGraph', () => {
  const raw = {
    directed: false,
    nodes: [
      { id: 'n1', label: 'a', community: 3, source_file: 'src/a/x.ts' },
      { id: 'n2', label: 'b', community: 3, source_file: 'src/a/y.ts' },
      { id: 'n3', label: 'c', community: 7, community_name: 'Community 7' },
    ],
    links: [
      { source: 'n1', target: 'n2', relation: 'imports', confidence: 'EXTRACTED' },
      { source: 'n2', target: 'n3', relation: 'calls', confidence: 'INFERRED' },
    ],
  };

  it('calcula o grau a partir das arestas', () => {
    const g = projectGraph(raw);
    expect(g.nodes.find((n) => n.id === 'n2')!.deg).toBe(2);
    expect(g.nodes.find((n) => n.id === 'n1')!.deg).toBe(1);
  });

  it('resolve nome de comunidade placeholder pelo diretório', () => {
    const g = projectGraph(raw);
    const c3 = g.communities.find((c) => c.id === 3)!;
    expect(c3.name).toBe('src/a');
    // comunidade 7 sem arquivos → "comunidade 7"
    expect(g.communities.find((c) => c.id === 7)!.name).toBe('comunidade 7');
  });

  it('preserva relation e confidence nas arestas', () => {
    const g = projectGraph(raw);
    const e = g.edges.find((x) => x.source === 'n2' && x.target === 'n3')!;
    expect(e.relation).toBe('calls');
    expect(e.confidence).toBe('INFERRED');
  });

  it('descarta arestas órfãs após o corte de nós', () => {
    const g = projectGraph({ nodes: [{ id: 'n1' }], links: [{ source: 'n1', target: 'ausente' }] });
    expect(g.edges).toHaveLength(0);
  });

  it('lida com entrada vazia/inválida', () => {
    expect(projectGraph(null).nodes).toHaveLength(0);
    expect(projectGraph({}).totalNodes).toBe(0);
  });
});
