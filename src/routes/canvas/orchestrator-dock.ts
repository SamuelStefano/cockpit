import type { TermStats } from '../../../shared/canvas';

// Pure sizing/status logic for the Orchestrator sidebar dock — kept separate
// from OrchestratorDock.tsx so width clamping and the running/idle read don't
// need a DOM or a mounted xterm to test.

export const MIN_DOCK_WIDTH = 360;
export const DEFAULT_DOCK_WIDTH = 420;
export const MAX_DOCK_FRACTION = 0.6; // of viewport width

export function clampDockWidth(width: number, viewportWidth: number): number {
  const max = Math.max(MIN_DOCK_WIDTH, viewportWidth * MAX_DOCK_FRACTION);
  return Math.min(max, Math.max(MIN_DOCK_WIDTH, width));
}

// Below this, there's no room for the canvas next to the sidebar — the
// sidebar becomes a full-screen sheet instead of a resizable dock.
export const MOBILE_BREAKPOINT = 480;
export const isMobileWidth = (viewportWidth: number) => viewportWidth <= MOBILE_BREAKPOINT;

// The dock's rodando/ocioso badge used to read this same CPU sample (≥2% =
// "running") — which disagreed with the kanban's own running/cv-live read
// whenever the process waited on the API (cpu ~0, still busy) or idled hot
// (review item 7). The badge now takes `live` straight from
// r.orchestratorItem?.running (Canvas.tsx); CPU is kept only as this
// secondary figure, never the running/idle read itself.
export function cpuLabel(stats: TermStats | undefined): string | null {
  if (!stats) return null;
  return `cpu ${Math.round(stats.cpu)}%`;
}
