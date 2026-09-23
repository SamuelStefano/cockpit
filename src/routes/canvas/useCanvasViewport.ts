import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasPos } from '../../../shared/canvas';

export interface View { x: number; y: number; k: number }

export const MIN_K = 0.08;
export const MAX_K = 2;
const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

// Zoom keeping the world point under (sx, sy) fixed on screen.
export function zoomAt(v: View, sx: number, sy: number, factor: number): View {
  const k = clampK(v.k * factor);
  const f = k / v.k;
  return { k, x: sx - (sx - v.x) * f, y: sy - (sy - v.y) * f };
}

// minK lets a caller ask for a readable floor (e.g. the initial framing of a
// small "core" box) instead of always shrinking to whatever fits exactly —
// "fit all" (the toolbar button) still wants the true fit, unfloored.
export function fitView(b: { x: number; y: number; w: number; h: number }, w: number, h: number, pad = 60, minK = MIN_K): View {
  const k = clampK(Math.max(minK, Math.min((w - pad * 2) / b.w, (h - pad * 2) / b.h, 1)));
  return { k, x: (w - b.w * k) / 2 - b.x * k, y: (h - b.h * k) / 2 - b.y * k };
}

export const toWorld = (v: View, sx: number, sy: number): CanvasPos => ({ x: (sx - v.x) / v.k, y: (sy - v.y) / v.k });

// Trackpad convention: plain wheel pans, pinch (ctrl+wheel) or ⌘/ctrl+wheel zooms.
// Two-finger touch pinches; one finger on the background pans.
export function useCanvasViewport() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.5 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; k: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) setView((v) => zoomAt(v, e.clientX - r.left, e.clientY - r.top, Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.008)));
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onBackgroundDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, []);

  const onBackgroundMove = useCallback((e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && ref.current) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (!pinch.current) { pinch.current = { d, k: viewRef.current.k }; return; }
      const r = ref.current.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2 - r.left; const cy = (pts[0].y + pts[1].y) / 2 - r.top;
      const target = pinch.current.k * (d / pinch.current.d);
      setView((v) => zoomAt(v, cx, cy, target / v.k));
      return;
    }
    setView((v) => ({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }));
  }, []);

  const onBackgroundUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const el = ref.current;
    if (!el) return;
    setView((v) => zoomAt(v, el.clientWidth / 2, el.clientHeight / 2, factor));
  }, []);

  const fit = useCallback((b: { x: number; y: number; w: number; h: number }, minK?: number) => {
    const el = ref.current;
    if (el) setView(fitView(b, el.clientWidth, el.clientHeight, 60, minK));
  }, []);

  const centerOn = useCallback((p: CanvasPos) => {
    const el = ref.current;
    if (!el) return;
    setView((v) => {
      const k = Math.max(v.k, 0.7);
      return { k, x: el.clientWidth / 2 - (p.x + 124) * k, y: el.clientHeight / 2 - (p.y + 46) * k };
    });
  }, []);

  return { ref, view, viewRef, onBackgroundDown, onBackgroundMove, onBackgroundUp, zoomBy, fit, centerOn };
}
