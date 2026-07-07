import { useEffect, useRef, useState, useCallback } from 'react';
import type { GraphData, GraphNode } from '../../../shared/protocol';
import { communityColor } from './community-color';

// Motor de força em canvas, sem dependência externa. Simulação: repulsão via grid
// espacial (O(n) aprox — não O(n²)), atração por mola nas arestas e gravidade fraca
// pro centro. Interação: pan (arrasto no vazio), zoom (scroll), drag de nó, hover.
// O componente GraphCanvas só monta o <canvas> e a moldura; toda a lógica mora aqui.

interface Pt { x: number; y: number; vx: number; vy: number }
interface View { tx: number; ty: number; scale: number }

const REPULSION = 5200;
const SPRING = 0.008;
const SPRING_LEN = 42;
const GRAVITY = 0.012;
const DAMPING = 0.86;
const CELL = 90; // célula do grid espacial (coords de mundo)

function nodeRadius(n: GraphNode): number { return 3 + Math.sqrt(n.deg) * 1.6; }

export function useForceGraph(graph: GraphData | null, opts: { selectedId?: string; onSelect?: (n: GraphNode) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const posRef = useRef<Map<string, Pt>>(new Map());
  const viewRef = useRef<View>({ tx: 0, ty: 0, scale: 1 });
  const alphaRef = useRef(1);
  const rafRef = useRef(0);
  const dragRef = useRef<{ id?: string; panning?: boolean; lastX: number; lastY: number } | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<{ source: string; target: string }[]>([]);
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map());
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const selectedRef = useRef<string | undefined>(opts.selectedId);
  selectedRef.current = opts.selectedId;
  const onSelectRef = useRef(opts.onSelect);
  onSelectRef.current = opts.onSelect;

  // (Re)inicializa posições quando o grafo troca. Espalha em anel por índice pra
  // dar um layout inicial sem sobreposição total antes de a simulação assentar.
  useEffect(() => {
    if (!graph) { nodesRef.current = []; edgesRef.current = []; posRef.current.clear(); return; }
    nodesRef.current = graph.nodes;
    edgesRef.current = graph.edges;
    const nb = new Map<string, Set<string>>();
    for (const e of graph.edges) {
      (nb.get(e.source) ?? nb.set(e.source, new Set()).get(e.source)!).add(e.target);
      (nb.get(e.target) ?? nb.set(e.target, new Set()).get(e.target)!).add(e.source);
    }
    neighborsRef.current = nb;
    const pos = new Map<string, Pt>();
    const n = graph.nodes.length;
    graph.nodes.forEach((node, i) => {
      const golden = i * 2.399963;
      const r = 12 * Math.sqrt(i + 1);
      pos.set(node.id, { x: Math.cos(golden) * r, y: Math.sin(golden) * r, vx: 0, vy: 0 });
    });
    posRef.current = pos;
    alphaRef.current = 1;
    fitView();
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  const resize = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.floor(rect.width * dpr()));
    c.height = Math.max(1, Math.floor(rect.height * dpr()));
  }, []);

  // Enquadra o grafo inteiro na viewport (bounding box → escala + centro).
  const fitView = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of posRef.current.values()) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    if (!isFinite(minX)) return;
    const w = maxX - minX || 1, h = maxY - minY || 1;
    const scale = Math.min(rect.width / (w * 1.15), rect.height / (h * 1.15), 2.5) || 1;
    viewRef.current = {
      scale,
      tx: rect.width / 2 - ((minX + maxX) / 2) * scale,
      ty: rect.height / 2 - ((minY + maxY) / 2) * scale,
    };
  }, []);

  const tick = useCallback(() => {
    const nodes = nodesRef.current, pos = posRef.current;
    const alpha = alphaRef.current;
    if (nodes.length) {
      // Grid espacial: agrupa nós por célula, repulsão só entre vizinhos de célula.
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
        p.vx = (p.vx + fx * alpha) * DAMPING;
        p.vy = (p.vy + fy * alpha) * DAMPING;
      }
      // Atração das arestas (mola pro comprimento de repouso).
      for (const e of edgesRef.current) {
        const a = pos.get(e.source), b = pos.get(e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d - SPRING_LEN) * SPRING * alpha;
        const ux = dx / d, uy = dy / d;
        a.vx += ux * f; a.vy += uy * f;
        b.vx -= ux * f; b.vy -= uy * f;
      }
      const dragId = dragRef.current?.id;
      for (const node of nodes) {
        if (node.id === dragId) continue; // nó arrastado é pinado
        const p = pos.get(node.id)!;
        p.x += p.vx; p.y += p.vy;
      }
      alphaRef.current = Math.max(0, alpha - 0.004);
    }
    render();
    if (alphaRef.current > 0.02 || dragRef.current) rafRef.current = requestAnimationFrame(tick);
    else rafRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const reheat = useCallback((a = 0.4) => { alphaRef.current = Math.max(alphaRef.current, a); start(); }, [start]);

  const render = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const v = viewRef.current, pos = posRef.current;
    const ratio = dpr();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.translate(v.tx, v.ty); ctx.scale(v.scale, v.scale);

    const hoverId = hoverIdRef.current;
    const selId = selectedRef.current;
    const focusId = hoverId ?? selId;
    const nb = focusId ? neighborsRef.current.get(focusId) : undefined;

    // Arestas
    ctx.lineWidth = 0.6 / v.scale;
    for (const e of edgesRef.current) {
      const a = pos.get(e.source), b = pos.get(e.target);
      if (!a || !b) continue;
      const incident = focusId && (e.source === focusId || e.target === focusId);
      ctx.strokeStyle = incident ? 'rgba(249,168,64,0.55)' : focusId ? 'rgba(120,120,130,0.05)' : 'rgba(120,120,130,0.14)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // Nós
    for (const node of nodesRef.current) {
      const p = pos.get(node.id); if (!p) continue;
      const r = nodeRadius(node);
      const dimmed = focusId && node.id !== focusId && !(nb && nb.has(node.id));
      ctx.globalAlpha = dimmed ? 0.25 : 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = communityColor(node.community);
      ctx.fill();
      if (node.id === selId || node.id === hoverId) {
        ctx.lineWidth = 2 / v.scale; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Rótulos: só nós grandes ou em foco, e só quando há zoom suficiente (anti-poluição).
    ctx.fillStyle = 'rgba(230,237,243,0.92)';
    ctx.font = `${11 / v.scale}px ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    for (const node of nodesRef.current) {
      const big = node.deg >= 10;
      const focus = node.id === focusId || (nb && nb.has(node.id));
      if (!focus && (!big || v.scale < 0.6)) continue;
      const p = pos.get(node.id); if (!p) continue;
      ctx.fillText(node.label, p.x + nodeRadius(node) + 2 / v.scale, p.y);
    }
  }, []);

  // ---- interação ----
  const worldAt = (clientX: number, clientY: number) => {
    const c = canvasRef.current!; const rect = c.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.tx) / v.scale, y: (clientY - rect.top - v.ty) / v.scale };
  };
  const nodeAt = (clientX: number, clientY: number): GraphNode | null => {
    const w = worldAt(clientX, clientY);
    let best: GraphNode | null = null, bestD = Infinity;
    for (const node of nodesRef.current) {
      const p = posRef.current.get(node.id); if (!p) continue;
      const r = nodeRadius(node) + 4 / viewRef.current.scale;
      const d = (p.x - w.x) ** 2 + (p.y - w.y) ** 2;
      if (d <= r * r && d < bestD) { best = node; bestD = d; }
    }
    return best;
  };

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    resize();
    const onResize = () => { resize(); render(); };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(() => { resize(); render(); });
    ro.observe(c);

    const onDown = (e: MouseEvent) => {
      const hit = nodeAt(e.clientX, e.clientY);
      if (hit) { dragRef.current = { id: hit.id, lastX: e.clientX, lastY: e.clientY }; onSelectRef.current?.(hit); }
      else dragRef.current = { panning: true, lastX: e.clientX, lastY: e.clientY };
      reheat(0.2);
    };
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (drag?.id) {
        const w = worldAt(e.clientX, e.clientY);
        const p = posRef.current.get(drag.id);
        if (p) { p.x = w.x; p.y = w.y; p.vx = 0; p.vy = 0; }
        reheat(0.3);
      } else if (drag?.panning) {
        viewRef.current.tx += e.clientX - drag.lastX;
        viewRef.current.ty += e.clientY - drag.lastY;
        drag.lastX = e.clientX; drag.lastY = e.clientY;
        render();
      } else {
        const hit = nodeAt(e.clientX, e.clientY);
        const id = hit?.id ?? null;
        if (id !== hoverIdRef.current) {
          hoverIdRef.current = id; setHovered(hit); render();
          c.style.cursor = hit ? 'pointer' : 'grab';
        }
      }
    };
    const onUp = () => { dragRef.current = null; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current; const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const ns = Math.min(6, Math.max(0.1, v.scale * factor));
      v.tx = mx - (mx - v.tx) * (ns / v.scale);
      v.ty = my - (my - v.ty) * (ns / v.scale);
      v.scale = ns; render();
    };
    c.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      c.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      c.removeEventListener('wheel', onWheel);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { render(); }, [opts.selectedId, render]);

  const resetView = useCallback(() => { fitView(); render(); }, [fitView, render]);

  return { canvasRef, hovered, resetView };
}
