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

// A cpu blip below this is measurement noise (idle process still ticks at
// ~0-1%), not the orchestrator actually turning — same floor TermStatsBar's
// heat scale treats as "cold".
const RUNNING_CPU_THRESHOLD = 2;

export function orchestratorRunning(stats: TermStats | undefined): boolean {
  if (!stats) return false;
  return stats.cpu >= RUNNING_CPU_THRESHOLD;
}
