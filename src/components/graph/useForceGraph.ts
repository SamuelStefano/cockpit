import { useEffect, useRef, useState, useCallback } from 'react';
import type { GraphData, GraphNode } from '../../../shared/protocol';
import { communityColor, repoColor } from './community-color';
import { communityLayout, type Pt } from './graph-layout';

export type ColorMode = 'community' | 'repo';
export interface ForceGraphOpts {
  selectedId?: string;
  onSelect?: (n: GraphNode) => void;
  colorMode?: ColorMode;
  query?: string;        // busca: acende matches, esmaece o resto
  focusRepo?: string | null; // legenda: isola um repo (esmaece os outros)
}

// Motor de força em canvas, sem dependência externa. Simulação: repulsão via grid
// espacial (O(n) aprox — não O(n²)), atração por mola nas arestas e gravidade fraca
// pro centro. Interação: pan (arrasto no vazio), zoom (scroll), drag de nó, hover.
// O componente GraphCanvas só monta o <canvas> e a moldura; toda a lógica mora aqui.
//
// Warm-start: ao abrir um grafo, a simulação roda "as cegas" (sem render, sem rAF)
// até quase assentar ANTES do primeiro paint — a partir de um layout já agrupado
// por comunidade (graph-layout.ts). Sem isso, nós conectados que nascem em lados
// opostos do mapa "caminham" na tela por ~4s até se juntar (o bug reportado).

interface View { tx: number; ty: number; scale: number }

const REPULSION = 5200;
const SPRING = 0.008;
const SPRING_LEN = 42;
const GRAVITY = 0.012;
const DAMPING = 0.86;
const CELL = 90; // célula do grid espacial (coords de mundo)
const MAX_SPEED = 40; // clamp por-tick: nó isolado/outlier não pode "disparar" pela tela
const WARM_START_BUDGET_MS = 500; // teto de tempo síncrono do pré-aquecimento (grafos gigantes não travam a UI)
const WARM_START_MAX_TICKS = 320;

function nodeRadius(n: GraphNode): number { return 3 + Math.sqrt(n.deg) * 1.6; }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

export function useForceGraph(graph: GraphData | null, opts: ForceGraphOpts) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const posRef = useRef<Map<string, Pt>>(new Map());
  const viewRef = useRef<View>({ tx: 0, ty: 0, scale: 1 });
  const fitScaleRef = useRef(1); // escala do enquadramento inicial — rótulos de hub só aparecem acima disto
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
  const colorModeRef = useRef<ColorMode>(opts.colorMode ?? 'community');
  colorModeRef.current = opts.colorMode ?? 'community';
  const queryRef = useRef<string>(opts.query ?? '');
  queryRef.current = opts.query ?? '';
  const focusRepoRef = useRef<string | null>(opts.focusRepo ?? null);
  focusRepoRef.current = opts.focusRepo ?? null;

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
    fitScaleRef.current = scale;
    viewRef.current = {
      scale,
      tx: rect.width / 2 - ((minX + maxX) / 2) * scale,
      ty: rect.height / 2 - ((minY + maxY) / 2) * scale,
    };
  }, []);

  // Passo físico puro: muta posRef, sem render nem agendamento. Usado tanto pelo
  // warm-start síncrono (sem tela) quanto pelo tick animado (com tela).
  const stepPhysics = useCallback((alpha: number) => {
    const nodes = nodesRef.current, pos = posRef.current;
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
  }, []);

  const nodeColor = (node: GraphNode, alpha = 1): string =>
    colorModeRef.current === 'repo' && node.repo ? repoColor(node.repo, alpha) : communityColor(node.community, alpha);

  const render = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const v = viewRef.current, pos = posRef.current;
    const ratio = dpr();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    // Fundo com vinheta radial sutil — dá profundidade sem competir com os nós.
    const cw = c.width / ratio, ch = c.height / ratio;
    const bg = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    bg.addColorStop(0, 'rgba(24,26,32,0.55)'); bg.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    ctx.translate(v.tx, v.ty); ctx.scale(v.scale, v.scale);

    const hoverId = hoverIdRef.current;
    const selId = selectedRef.current;
    const focusId = hoverId ?? selId;
    const nb = focusId ? neighborsRef.current.get(focusId) : undefined;
    const q = queryRef.current.trim().toLowerCase();
    const focusRepo = focusRepoRef.current;

    // Decide se um nó está "apagado" (esmaecido). Precedência: busca > foco de
    // repo (legenda) > foco por hover/seleção. Busca acesa = match no label.
    const isMatch = (node: GraphNode) => !!q && node.label.toLowerCase().includes(q);
    const isDim = (node: GraphNode): boolean => {
      if (q) return !isMatch(node);
      if (focusRepo) return node.repo !== focusRepo;
      if (focusId) return node.id !== focusId && !(nb && nb.has(node.id));
      return false;
    };
    const anyFocus = !!(q || focusRepo || focusId);

    ctx.lineWidth = 0.6 / v.scale;
    for (const e of edgesRef.current) {
      const a = pos.get(e.source), b = pos.get(e.target);
      if (!a || !b) continue;
      const incident = focusId && (e.source === focusId || e.target === focusId);
      ctx.strokeStyle = incident ? 'rgba(249,168,64,0.5)' : anyFocus ? 'rgba(120,120,130,0.04)' : 'rgba(120,120,130,0.13)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    const hubGlow = 14; // grau a partir do qual o nó ganha glow (hub visualmente destacado)
    for (const node of nodesRef.current) {
      const p = pos.get(node.id); if (!p) continue;
      const r = nodeRadius(node);
      const dim = isDim(node);
      const lit = !dim && (isMatch(node) || node.id === selId || node.id === hoverId || (anyFocus && !dim));
      ctx.globalAlpha = dim ? 0.18 : 1;
      // Glow: hubs sempre, e qualquer nó aceso (match/seleção/hover). shadowBlur é
      // caro — só ligo onde importa, não nos milhares de nós comuns.
      const glow = !dim && (node.deg >= hubGlow || lit);
      // shadowBlur em unidades de mundo (escala com o zoom): mais forte no que
      // está aceso pela busca/hover, sutil nos hubs comuns.
      if (glow) { ctx.shadowColor = nodeColor(node, 0.9); ctx.shadowBlur = isMatch(node) || node.id === hoverId ? 16 : 6; }
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

    // Rótulos: match de busca e nós em foco sempre; hub (grau alto) só depois de
    // zoom além do fit inicial (evita centenas de labels sobrepostos ao abrir).
    ctx.font = `${11 / v.scale}px ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    const hubZoomGate = fitScaleRef.current * 1.6;
    for (const node of nodesRef.current) {
      const match = isMatch(node);
      const focus = node.id === focusId || (nb && nb.has(node.id)) || (focusRepo && node.repo === focusRepo);
      const big = node.deg >= 10;
      if (!match && !focus && (!big || v.scale < hubZoomGate)) continue;
      if (isDim(node)) continue;
      const p = pos.get(node.id); if (!p) continue;
      ctx.fillStyle = match ? '#fff' : 'rgba(230,237,243,0.9)';
      ctx.fillText(node.label, p.x + nodeRadius(node) + 2 / v.scale, p.y);
    }
  }, []);

  const tick = useCallback(() => {
    const alpha = alphaRef.current;
    if (nodesRef.current.length) {
      stepPhysics(alpha);
      alphaRef.current = Math.max(0, alpha - 0.004);
    }
    render();
    if (alphaRef.current > 0.02 || dragRef.current) rafRef.current = requestAnimationFrame(tick);
    else rafRef.current = 0;
  }, [stepPhysics, render]);

  const start = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const reheat = useCallback((a = 0.4) => { alphaRef.current = Math.max(alphaRef.current, a); start(); }, [start]);

  // Roda a física "às cegas" (sem tela) até quase assentar, partindo do layout já
  // agrupado por comunidade. Decaimento de alpha mais agressivo que o tick animado
  // — não precisa ser suave, ninguém está vendo. O resíduo de alpha vira uma
  // cauda quase imperceptível no tick normal (poucos frames), então drag/hover
  // continuam funcionando normalmente depois.
  const warmStart = useCallback(() => {
    const t0 = performance.now();
    let alpha = 1;
    let ticks = 0;
    while (alpha > 0.05 && ticks < WARM_START_MAX_TICKS && performance.now() - t0 < WARM_START_BUDGET_MS) {
      stepPhysics(alpha);
      alpha = Math.max(0, alpha - 0.012);
      ticks++;
    }
    alphaRef.current = alpha;
  }, [stepPhysics]);

  // (Re)inicializa quando o grafo troca: layout por comunidade, pré-aquece,
  // enquadra e pinta o frame já quase-assentado ANTES do usuário ver algo mexer.
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
    warmStart();
    fitView();
    render();
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

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

  // Repinta quando qualquer entrada visual muda (seleção, cor, busca, foco de repo).
  useEffect(() => { render(); }, [opts.selectedId, opts.colorMode, opts.query, opts.focusRepo, render]);

  const resetView = useCallback(() => { fitView(); render(); }, [fitView, render]);

  // Centraliza a viewport num nó (usado pela busca e pelo clique em vizinho no
  // painel de detalhe). Zoom confortável se estava muito afastado.
  const focusNode = useCallback((id: string) => {
    const c = canvasRef.current; const p = posRef.current.get(id);
    if (!c || !p) return;
    const rect = c.getBoundingClientRect();
    const v = viewRef.current;
    const target = Math.max(v.scale, fitScaleRef.current * 2.2);
    viewRef.current = { scale: target, tx: rect.width / 2 - p.x * target, ty: rect.height / 2 - p.y * target };
    render();
  }, [render]);

  return { canvasRef, hovered, resetView, focusNode };
}
