import type { GraphNode, GraphEdge } from '../../../shared/protocol';
import type { Pt } from './graph-layout';
import { communityColor, repoColor } from './community-color';

export type ColorMode = 'community' | 'repo';

export interface RenderState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  pos: Map<string, Pt>;
  view: { tx: number; ty: number; scale: number };
  ratio: number;         // devicePixelRatio efetivo
  canvasW: number;       // largura do backing store (device px)
  canvasH: number;
  hoverId: string | null;
  selId: string | undefined;
  colorMode: ColorMode;
  query: string;
  focusRepo: string | null;
  neighbors: Map<string, Set<string>>;
  fitScale: number;      // escala do enquadramento inicial (gate dos rótulos de hub)
}

function nodeRadius(n: GraphNode): number { return 3 + Math.sqrt(n.deg) * 1.6; }

const HUB_GLOW = 14; // grau a partir do qual o nó ganha glow

// Desenha um frame inteiro do grafo. Puro no sentido de não tocar em estado do
// hook — só lê RenderState e pinta. Toda a lógica de foco/busca/cor mora aqui.
export function renderGraph(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { pos, view: v, ratio } = s;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, s.canvasW, s.canvasH);
  // Vinheta radial sutil — profundidade sem competir com os nós.
  const cw = s.canvasW / ratio, ch = s.canvasH / ratio;
  const bg = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
  bg.addColorStop(0, 'rgba(24,26,32,0.55)'); bg.addColorStop(1, 'rgba(10,10,12,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
  ctx.translate(v.tx, v.ty); ctx.scale(v.scale, v.scale);

  const hoverId = s.hoverId;
  const selId = s.selId;
  const focusId = hoverId ?? selId;
  const nb = focusId ? s.neighbors.get(focusId) : undefined;
  const q = s.query.trim().toLowerCase();
  const focusRepo = s.focusRepo;
  const nodeColor = (n: GraphNode, alpha = 1) => (s.colorMode === 'repo' && n.repo ? repoColor(n.repo, alpha) : communityColor(n.community, alpha));

  // Precedência do esmaecimento: busca > foco de repo (legenda) > hover/seleção.
  const isMatch = (n: GraphNode) => !!q && n.label.toLowerCase().includes(q);
  const isDim = (n: GraphNode): boolean => {
    if (q) return !isMatch(n);
    if (focusRepo) return n.repo !== focusRepo;
    if (focusId) return n.id !== focusId && !(nb && nb.has(n.id));
    return false;
  };
  const anyFocus = !!(q || focusRepo || focusId);

  // Arestas: INFERRED tracejadas (confiança menor), EXTRACTED sólidas.
  ctx.lineWidth = 0.6 / v.scale;
  for (const e of s.edges) {
    const a = pos.get(e.source), b = pos.get(e.target);
    if (!a || !b) continue;
    const incident = focusId && (e.source === focusId || e.target === focusId);
    ctx.strokeStyle = incident ? 'rgba(249,168,64,0.5)' : anyFocus ? 'rgba(120,120,130,0.04)' : 'rgba(120,120,130,0.13)';
    if (e.confidence === 'INFERRED') ctx.setLineDash([3 / v.scale, 3 / v.scale]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    if (e.confidence === 'INFERRED') ctx.setLineDash([]);
  }

  for (const node of s.nodes) {
    const p = pos.get(node.id); if (!p) continue;
    const r = nodeRadius(node);
    const dim = isDim(node);
    const lit = !dim && (isMatch(node) || node.id === selId || node.id === hoverId || anyFocus);
    ctx.globalAlpha = dim ? 0.18 : 1;
    // Glow só onde importa (hub/aceso) — shadowBlur é caro pra milhares de nós.
    if (!dim && (node.deg >= HUB_GLOW || lit)) {
      ctx.shadowColor = nodeColor(node, 0.9);
      ctx.shadowBlur = isMatch(node) || node.id === hoverId ? 16 : 6;
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = nodeColor(node);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (node.id === selId || node.id === hoverId || isMatch(node)) {
      ctx.lineWidth = (node.id === selId ? 2.5 : 1.5) / v.scale;
      ctx.strokeStyle = node.id === selId ? '#fff' : 'rgba(255,255,255,0.75)';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Rótulos: match e nós em foco sempre; hub (grau alto) só além do fit inicial.
  ctx.font = `${11 / v.scale}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  const hubZoomGate = s.fitScale * 1.6;
  for (const node of s.nodes) {
    const match = isMatch(node);
    const focus = node.id === focusId || (nb && nb.has(node.id)) || (focusRepo && node.repo === focusRepo);
    const big = node.deg >= 10;
    if (!match && !focus && (!big || v.scale < hubZoomGate)) continue;
    if (isDim(node)) continue;
    const p = pos.get(node.id); if (!p) continue;
    ctx.fillStyle = match ? '#fff' : 'rgba(230,237,243,0.9)';
    ctx.fillText(node.label, p.x + nodeRadius(node) + 2 / v.scale, p.y);
  }
}
