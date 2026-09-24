import type { CanvasNode, OrchestratorInfo } from '../../../shared/canvas';

// Matches the two node kinds that represent the SAME orchestrator: the canvas
// shell window it runs `claude` in (tmux `cockpit-cv-*`, termId is the tmux
// name minus the `cockpit-` prefix server/terminals.ts adds — see PREFIX
// there) and the session card/window bound to its sessionId in the kanban.
export function isOrchestratorNode(n: Pick<CanvasNode, 'kind' | 'ref'>, o: OrchestratorInfo | undefined): boolean {
  if (!o) return false;
  if (n.kind === 'session') return n.ref === o.sessionId;
  if (n.kind === 'shell') return n.ref === o.tmux.replace(/^cockpit-/, '');
  return false;
}

// The terminal id the sidebar dock attaches to directly — always the shell
// pane (tmux name minus prefix), independent of whether that node has shown
// up on the canvas map yet.
export const orchestratorTermId = (o: OrchestratorInfo) => o.tmux.replace(/^cockpit-/, '');
