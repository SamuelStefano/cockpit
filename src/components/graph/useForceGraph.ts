import { useEffect, useRef, useState, useCallback } from 'react';
import type { GraphData, GraphNode } from '../../../shared/protocol';
import { communityLayout, type Pt } from './graph-layout';
import { stepPhysics } from './graph-physics';
import { renderGraph, type ColorMode } from './graph-render';

export type { ColorMode };
export interface ForceGraphOpts {
  selectedId?: string;
  onSelect?: (n: GraphNode, mod?: { shiftKey?: boolean }) => void;
  colorMode?: ColorMode;
  query?: string;            // busca: acende matches, esmaece o resto
  focusRepo?: string | null; // legenda: isola um repo (esmaece os outros)
}

// Motor de força em canvas, sem dependência externa. A física (graph-physics) e o
// render (graph-render) são módulos puros; este hook só orquestra: lifecycle,
// warm-start e interação (pan/zoom/drag/hover via pointer events, com pinch).
//
// Warm-start: ao abrir um grafo, a simulação roda "às cegas" (sem tela) até quase
// assentar ANTES do primeiro paint, a partir de um layout já agrupado por
// comunidade — sem isso os nós "caminham" na tela por segundos até se juntar.

interface View { tx: number; ty: number; scale: number }
const WARM_START_BUDGET_MS = 500;
const WARM_START_MAX_TICKS = 320;
function nodeRadius(n: GraphNode): number { return 3 + Math.sqrt(n.deg) * 1.6; }

export function useForceGraph(graph: GraphData | null, opts: ForceGraphOpts) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const posRef = useRef<Map<string, Pt>>(new Map());
  const viewRef = useRef<View>({ tx: 0, ty: 0, scale: 1 });
  const fitScaleRef = useRef(1);
  const alphaRef = useRef(1);
  const rafRef = useRef(0);
  const dragRef = useRef<{ id?: string; panning?: boolean; lastX: number; lastY: number } | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphData['edges']>([]);
  const neighborsRef = useRef<Map<string, Set<string>>>(new Map());
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<number | null>(null); // distância do pinch anterior
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const optsRef = useRef(opts); optsRef.current = opts;

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  const resize = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.floor(rect.width * dpr()));
    c.height = Math.max(1, Math.floor(rect.height * dpr()));
  }, []);

  const render = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    renderGraph(ctx, {
      nodes: nodesRef.current, edges: edgesRef.current, pos: posRef.current,
      view: viewRef.current, ratio: dpr(), canvasW: c.width, canvasH: c.height,
      hoverId: hoverIdRef.current, selId: optsRef.current.selectedId,
      colorMode: optsRef.current.colorMode ?? 'community',
      query: optsRef.current.query ?? '', focusRepo: optsRef.current.focusRepo ?? null,
      neighbors: neighborsRef.current, fitScale: fitScaleRef.current,
    });
  }, []);

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
    fitScaleRef.current = scale;
    viewRef.current = { scale, tx: rect.width / 2 - ((minX + maxX) / 2) * scale, ty: rect.height / 2 - ((minY + maxY) / 2) * scale };
  }, []);

  const tick = useCallback(() => {
    if (nodesRef.current.length) {
      stepPhysics(nodesRef.current, edgesRef.current, posRef.current, dragRef.current?.id, alphaRef.current);
      alphaRef.current = Math.max(0, alphaRef.current - 0.004);
    }
    render();
    if (alphaRef.current > 0.02 || dragRef.current) rafRef.current = requestAnimationFrame(tick);
    else rafRef.current = 0;
  }, [render]);

  const start = useCallback(() => { if (!rafRef.current) rafRef.current = requestAnimationFrame(tick); }, [tick]);
  const reheat = useCallback((a = 0.4) => { alphaRef.current = Math.max(alphaRef.current, a); start(); }, [start]);

  const warmStart = useCallback(() => {
    const t0 = performance.now();
    let alpha = 1, ticks = 0;
    while (alpha > 0.05 && ticks < WARM_START_MAX_TICKS && performance.now() - t0 < WARM_START_BUDGET_MS) {
      stepPhysics(nodesRef.current, edgesRef.current, posRef.current, undefined, alpha);
      alpha = Math.max(0, alpha - 0.012); ticks++;
    }
    alphaRef.current = alpha;
  }, []);

  // (Re)inicializa quando o grafo troca: layout por comunidade, pré-aquece,
  // enquadra e pinta o frame já quase-assentado antes do usuário ver algo mexer.
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
    posRef.current = communityLayout(graph.nodes);
    warmStart(); fitView(); render(); start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // ---- interação (pointer events: mouse + touch + pinch) ----
  const worldAt = (clientX: number, clientY: number) => {
    const c = canvasRef.current!; const rect = c.getBoundingClientRect(); const v = viewRef.current;
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
  const zoomAt = (mx: number, my: number, factor: number) => {
    const v = viewRef.current;
    const ns = Math.min(6, Math.max(0.1, v.scale * factor));
    v.tx = mx - (mx - v.tx) * (ns / v.scale);
    v.ty = my - (my - v.ty) * (ns / v.scale);
    v.scale = ns;
  };

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    resize();
    const onResize = () => { resize(); render(); };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(() => { resize(); render(); });
    ro.observe(c);
    const rectOf = () => c.getBoundingClientRect();

    const onDown = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) { pinchRef.current = null; dragRef.current = null; return; }
      const hit = nodeAt(e.clientX, e.clientY);
      if (hit) { dragRef.current = { id: hit.id, lastX: e.clientX, lastY: e.clientY }; optsRef.current.onSelect?.(hit, { shiftKey: e.shiftKey }); }
      else dragRef.current = { panning: true, lastX: e.clientX, lastY: e.clientY };
      reheat(0.2);
    };
    const onMove = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) { // pinch
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchRef.current != null && pinchRef.current > 0) {
          const rect = rectOf();
          zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, dist / pinchRef.current);
          render();
        }
        pinchRef.current = dist;
        return;
      }
      const drag = dragRef.current;
      if (drag?.id) {
        const w = worldAt(e.clientX, e.clientY);
        const p = posRef.current.get(drag.id);
        if (p) { p.x = w.x; p.y = w.y; p.vx = 0; p.vy = 0; }
        reheat(0.3);
      } else if (drag?.panning) {
        viewRef.current.tx += e.clientX - drag.lastX; viewRef.current.ty += e.clientY - drag.lastY;
        drag.lastX = e.clientX; drag.lastY = e.clientY; render();
      } else {
        const hit = nodeAt(e.clientX, e.clientY);
        const id = hit?.id ?? null;
        if (id !== hoverIdRef.current) { hoverIdRef.current = id; setHovered(hit); render(); c.style.cursor = hit ? 'pointer' : 'grab'; }
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchRef.current = null;
      if (pointers.current.size === 0) dragRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = rectOf();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
      render();
    };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointercancel', onUp);
      c.removeEventListener('wheel', onWheel);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repinta quando qualquer entrada visual muda.
  useEffect(() => { render(); }, [opts.selectedId, opts.colorMode, opts.query, opts.focusRepo, render]);

  const resetView = useCallback(() => { fitView(); render(); }, [fitView, render]);

  const focusNode = useCallback((id: string) => {
    const c = canvasRef.current; const p = posRef.current.get(id);
    if (!c || !p) return;
    const rect = c.getBoundingClientRect(); const v = viewRef.current;
    const target = Math.max(v.scale, fitScaleRef.current * 2.2);
    viewRef.current = { scale: target, tx: rect.width / 2 - p.x * target, ty: rect.height / 2 - p.y * target };
    render();
  }, [render]);

  return { canvasRef, hovered, resetView, focusNode };
}
