import type { CanvasFlowRun } from '../../shared/canvas';

// Transient (process memory only, never persisted to the board file):
// card-target flow runs still live right now. server/canvas/flows.ts's
// deliverToCard registers one right after startRun admits; handleTurnClosed
// clears it on that SAME sessionKey's next turn close, success or failure —
// the run is over either way. Read by server/ws/dispatch.ts to fold into
// every canvas-board answer, so a tab that (re)connects mid-run (F5, a
// second tab, opening /canvas after the flow already fired) doesn't have to
// have caught the one-shot canvas-flow-run broadcast to know the card is
// running.

const live = new Map<string, { cardId: string; flowId: string }>();

export function registerFlowRun(runKey: string, cardId: string, flowId: string): void {
  live.set(runKey, { cardId, flowId });
}

export function clearFlowRun(runKey: string): void {
  live.delete(runKey);
}

export function activeFlowRuns(): CanvasFlowRun[] {
  return [...live.entries()].map(([runKey, v]) => ({ runKey, ...v }));
}

// Test-only: the map is module-level/process-lifetime.
export function __resetFlowRuns(): void {
  live.clear();
}
