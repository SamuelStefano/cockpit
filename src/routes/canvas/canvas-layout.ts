import type { CanvasEdge, CanvasNode, CanvasPos } from '../../../shared/canvas';

// Deterministic first placement: hubs on a grid, their leaves in rings around
// them, sessions orbiting the contexts they touched, cards above what they bind.
// A position the user dragged always wins over this.

export const NODE_W = 248;
export const NODE_H = 92;
// Collapsed height below CanvasSurface's COMPACT_BELOW zoom threshold
// (CanvasNodeCard renders `minHeight` this tall instead of the full NODE_H) —
// shared so CanvasFlows.tsx anchors a port/arrow at the node's ACTUAL edge
// instead of one that's 92px tall on screen but only ~44px in the DOM.
export const COMPACT_NODE_H = 44;
const X_STRETCH = 1.35;
const GAP = 110;
const RING0 = 230;
const RING_STEP = 125;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function ringsFor(count: number): number {
  let r = 0; let left = count; let cap = 8;
  while (left > cap) { left -= cap; r++; cap = 8 + r * 6; }
  return count ? r : -1;
}

function ring(center: CanvasPos, i: number): CanvasPos {
  let r = 0; let slot = i; let cap = 8;
  while (slot >= cap) { slot -= cap; r++; cap = 8 + r * 6; }
  const angle = (slot / cap) * Math.PI * 2 + r * 0.4;
  const radius = RING0 + r * RING_STEP;
  return { x: center.x + Math.cos(angle) * radius * X_STRETCH, y: center.y + Math.sin(angle) * radius };
}

export function layoutCanvas(nodes: CanvasNode[], edges: CanvasEdge[], saved: Record<string, CanvasPos>): Record<string, CanvasPos> {
  const out: Record<string, CanvasPos> = {};
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nbrs = new Map<string, string[]>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    nbrs.set(e.source, [...(nbrs.get(e.source) ?? []), e.target]);
    nbrs.set(e.target, [...(nbrs.get(e.target) ?? []), e.source]);
  }
  const degree = (id: string) => nbrs.get(id)?.length ?? 0;

  const contexts = nodes.filter((n) => n.kind === 'context');
  const hubs = contexts.filter((n) => n.hub).sort((a, b) => degree(b.id) - degree(a.id) || a.id.localeCompare(b.id));
  const hubOf = new Map<string, string>();
  for (const e of edges) {
    if (e.kind !== 'link') continue;
    if (byId.get(e.source)?.hub && !byId.get(e.target)?.hub && !hubOf.has(e.target)) hubOf.set(e.target, e.source);
  }
  const members = new Map<string, CanvasNode[]>();
  // Ordered by id, not mtime: a memory write bumps mtime on every save, which
  // used to jump that leaf to ring slot 0 and shove every sibling in its
  // cluster over on the very next graph refresh (canvas review #5). id has no
  // reason to change once assigned, so a leaf keeps its slot for its whole life.
  for (const c of contexts.filter((n) => !n.hub).sort((a, b) => a.id.localeCompare(b.id))) {
    const cluster = hubOf.get(c.id) ?? '';
    members.set(cluster, [...(members.get(cluster) ?? []), c]);
  }
  // Each cluster gets a box sized by its ring count; boxes are packed in rows
  // about twice as wide as tall, which fits the wide canvas panel.
  const clusters = [...hubs.map((h) => h.id), ...(members.has('') ? [''] : [])];
  const radius = (id: string) => RING0 + ringsFor(members.get(id)?.length ?? 0) * RING_STEP;
  const boxW = (id: string) => radius(id) * 2 * X_STRETCH + NODE_W + GAP;
  const boxH = (id: string) => radius(id) * 2 + NODE_H + GAP;
  const area = clusters.reduce((a, id) => a + boxW(id) * boxH(id), 0);
  const rowMax = Math.max(...clusters.map(boxW), Math.sqrt(area * 2.2));
  const centerOf = new Map<string, CanvasPos>();
  let x = 0; let y = 0; let rowH = 0;
  for (const id of clusters) {
    if (x > 0 && x + boxW(id) > rowMax) { x = 0; y += rowH; rowH = 0; }
    centerOf.set(id, { x: x + boxW(id) / 2, y: y + boxH(id) / 2 });
    x += boxW(id); rowH = Math.max(rowH, boxH(id));
  }

  for (const h of hubs) out[h.id] = centerOf.get(h.id)!;
  for (const [cluster, list] of members) list.forEach((c, i) => { out[c.id] = ring(centerOf.get(cluster)!, i); });

  // Ordered by id too, for the same reason: any activity on a session bumps
  // its mtime, which used to reshuffle its own orbit slot and, via `orbit`'s
  // running counter, every OTHER session sharing the same anchor context.
  const sessions = nodes.filter((n) => n.kind === 'session').sort((a, b) => a.id.localeCompare(b.id));
  const ctxOf = (id: string) => (nbrs.get(id) ?? []).filter((x) => out[x] && byId.get(x)?.kind === 'context');
  // Sessions with no memory trail form a compact block left of the clusters,
  // in the same stable order, so a hundred of them never stretch the map into
  // a thin column and never trade places on their own.
  const orphans = sessions.filter((s) => !ctxOf(s.id).length);
  const orphanCols = Math.max(2, Math.ceil(Math.sqrt(orphans.length * 1.6)));
  const orphanX0 = -GAP * 3 - orphanCols * (NODE_W + 28);
  orphans.forEach((s, i) => {
    out[s.id] = { x: orphanX0 + (i % orphanCols) * (NODE_W + 28), y: Math.floor(i / orphanCols) * (NODE_H + 28) };
  });
  const orbit = new Map<string, number>();
  for (const s of sessions) {
    const ctx = ctxOf(s.id);
    if (!ctx.length) continue;
    const cx = ctx.reduce((a, id) => a + out[id].x, 0) / ctx.length;
    const cy = ctx.reduce((a, id) => a + out[id].y, 0) / ctx.length;
    const anchor = ctx[0];
    const k = orbit.get(anchor) ?? 0;
    orbit.set(anchor, k + 1);
    const angle = k * GOLDEN + (hash(anchor) % 628) / 100;
    const radius = 150 + k * 24;
    out[s.id] = { x: cx + Math.cos(angle) * radius * 1.4, y: cy + Math.sin(angle) * radius };
  }

  let cardX = 0;
  for (const c of nodes.filter((n) => n.kind === 'card')) {
    const linked = (nbrs.get(c.id) ?? []).filter((id) => out[id]);
    if (!linked.length) { out[c.id] = { x: cardX, y: -GAP * 3 }; cardX += NODE_W + 40; continue; }
    const cx = linked.reduce((a, id) => a + out[id].x, 0) / linked.length;
    const cy = Math.min(...linked.map((id) => out[id].y));
    out[c.id] = { x: cx + ((hash(c.id) % 120) - 60), y: cy - 190 };
  }

  for (const n of nodes) if (saved[n.id]) out[n.id] = saved[n.id];
  return out;
}

// A rect without w/h is a plain node; terminal windows pass their own size.
export function bounds(pos: (CanvasPos & { w?: number; h?: number })[]): { x: number; y: number; w: number; h: number } {
  if (!pos.length) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.min(...pos.map((p) => p.x)); const y = Math.min(...pos.map((p) => p.y));
  const right = Math.max(...pos.map((p) => p.x + (p.w ?? NODE_W)));
  const bottom = Math.max(...pos.map((p) => p.y + (p.h ?? NODE_H)));
  return { x, y, w: right - x, h: bottom - y };
}
