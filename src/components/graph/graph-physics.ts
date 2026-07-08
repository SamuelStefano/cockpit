import type { GraphNode } from '../../../shared/protocol';
import type { Pt } from './graph-layout';

// Física do force-graph, pura e testável: repulsão via grid espacial (O(n) aprox,
// não O(n²)), atração por mola nas arestas, gravidade fraca pro centro. Muta o
// mapa de posições in-place; não toca em canvas nem em rAF (o hook orquestra).

export const REPULSION = 5200;
export const SPRING = 0.008;
export const SPRING_LEN = 42;
export const GRAVITY = 0.012;
export const DAMPING = 0.86;
export const CELL = 90; // célula do grid espacial (coords de mundo)
export const MAX_SPEED = 40; // clamp por-tick: nó isolado não pode "disparar" pela tela

export interface Edge { source: string; target: string }

function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

export function stepPhysics(nodes: GraphNode[], edges: Edge[], pos: Map<string, Pt>, dragId: string | undefined, alpha: number): void {
  if (!nodes.length) return;
  const grid = new Map<string, string[]>();
  for (const node of nodes) {
    const p = pos.get(node.id)!;
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(node.id);
  }
  for (const node of nodes) {
    const p = pos.get(node.id)!;
    let fx = 0, fy = 0;
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const cell = grid.get(`${gx},${gy}`); if (!cell) continue;
        for (const oid of cell) {
          if (oid === node.id) continue;
          const o = pos.get(oid)!;
          let dx = p.x - o.x, dy = p.y - o.y;
          let d2 = dx * dx + dy * dy;
          if (d2 === 0) { dx = Math.cos(node.id.length) * 0.5; dy = 0.5; d2 = 0.5; }
          if (d2 > CELL * CELL * 4) continue;
          const f = REPULSION / d2;
          const d = Math.sqrt(d2);
          fx += (dx / d) * f; fy += (dy / d) * f;
        }
      }
    }
    fx -= p.x * GRAVITY; fy -= p.y * GRAVITY;
    p.vx = clamp((p.vx + fx * alpha) * DAMPING, -MAX_SPEED, MAX_SPEED);
    p.vy = clamp((p.vy + fy * alpha) * DAMPING, -MAX_SPEED, MAX_SPEED);
  }
  for (const e of edges) {
    const a = pos.get(e.source), b = pos.get(e.target);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const f = (d - SPRING_LEN) * SPRING * alpha;
    const ux = dx / d, uy = dy / d;
    a.vx += ux * f; a.vy += uy * f;
    b.vx -= ux * f; b.vy -= uy * f;
  }
  for (const node of nodes) {
    if (node.id === dragId) continue; // nó arrastado é pinado
    const p = pos.get(node.id)!;
    p.x += p.vx; p.y += p.vy;
  }
}
