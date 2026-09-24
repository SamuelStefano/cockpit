import { orchestratorTermId, type CanvasNode, type OrchestratorInfo } from '../../../shared/canvas';

export { orchestratorTermId };

// Matches the two node kinds that represent the SAME orchestrator: the canvas
// shell window it runs `claude` in (tmux `cockpit-cv-*`, termId is the tmux
// name minus the `cockpit-` prefix server/terminals.ts adds — see PREFIX
// there) and the session card/window bound to its sessionId in the kanban.
export function isOrchestratorNode(n: Pick<CanvasNode, 'kind' | 'ref'>, o: OrchestratorInfo | undefined): boolean {
  if (!o) return false;
  if (n.kind === 'session') return n.ref === o.sessionId;
  if (n.kind === 'shell') return n.ref === orchestratorTermId(o);
  return false;
}
