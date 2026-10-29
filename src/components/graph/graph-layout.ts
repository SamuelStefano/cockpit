import type { GraphNode } from '../../../shared/protocol';

export interface Pt { x: number; y: number; vx: number; vy: number }

// Hash determinístico (FNV-1a) — mesmo id sempre cai no mesmo ângulo/raio dentro
// do cluster. Layout estável entre reaberturas do mesmo grafo (sem "reembaralhar").
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Posição inicial AGRUPADA POR COMUNIDADE, não por ordem de índice no array. O
// bug original: nós espalhados em espiral pela ordem do graph.json — dois nós da
// mesma comunidade (conectados, então atraídos pela mola) podiam nascer em lados
// opostos do mapa, e a simulação "caminhava" centenas de nós por ~4s até juntar
// tudo. Com o layout já agrupado, a simulação só precisa de ajustes locais —
// o warm-start (useForceGraph) resolve isso antes do primeiro frame visível.
//
// Centroides de comunidade em espiral de Fermat (Vogel) — empacota sem overlap
// sistemático. Membros de cada comunidade espalhados ao redor do centroide com
// raio/ângulo hasheados do próprio id (determinístico, sem Math.random()).
export function communityLayout(nodes: GraphNode[]): Map<string, Pt> {
  const byCommunity = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    (byCommunity.get(n.community) ?? byCommunity.set(n.community, []).get(n.community)!).push(n);
  }
  const communities = [...byCommunity.keys()].sort((a, b) => a - b);
  const numCommunities = communities.length || 1;
  const galaxyRadius = 9 * Math.sqrt(nodes.length) + 40;
  const GOLDEN_ANGLE = 2.399963;

  const pos = new Map<string, Pt>();
  communities.forEach((cid, ci) => {
    const members = byCommunity.get(cid)!;
    const angle = ci * GOLDEN_ANGLE;
    const spiralR = galaxyRadius * Math.sqrt((ci + 0.5) / numCommunities);
    const cx = Math.cos(angle) * spiralR;
    const cy = Math.sin(angle) * spiralR;
    const clusterR = 8 * Math.sqrt(members.length) + 6;
    for (const node of members) {
      const h = hashStr(node.id);
      const a = (h % 6283) / 1000; // ângulo determinístico 0..2π
      const rr = clusterR * Math.sqrt(((h >>> 8) % 1000) / 1000); // raio (sqrt = densidade uniforme no disco)
      pos.set(node.id, { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, vx: 0, vy: 0 });
    }
  });
  return pos;
}
