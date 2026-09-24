import type { CanvasNode, CanvasPos, OrchestratorInfo, TermStats } from '../../../shared/canvas';
import type { TermApi } from '../../useCockpit';
import { isOrchestratorNode } from './orchestrator';
import { TerminalWindow } from './TerminalWindow';
import { termTarget, type CanvasTerms } from './useCanvasTerms';

interface Props {
  nodes: CanvasNode[];
  pos: Record<string, CanvasPos>;
  terms: CanvasTerms;
  term: TermApi;
  selected: Set<string>;
  focus: Set<string>;
  running: Set<string>;
  waiting: Set<string>;
  orchestrator: OrchestratorInfo | undefined;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onOpenChat: (sessionId: string) => void;
  onSendTo: (sessionId: string, text: string) => boolean;
  sendError: { sessionId: string; text: string; message: string } | null;
  onDismissSendError: () => void;
  stats: Record<string, TermStats>;
  past: boolean; // timeline scrubbed away from live: every window shows the overlay
  pastAlive: Set<string> | null; // and one not alive at T also fades
  instant: boolean; // timeline is playing: skip the opacity transition (perf)
}

// Paint order (lowest first, so later entries sit on top of earlier ones
// where they overlap): plain window, active window, orchestrator window —
// the orchestrator outranks even the active window, so it's always findable.
export function CanvasWindows(p: Props) {
  const t = p.terms;
  const list = [...p.nodes].sort((a, b) => {
    const rank = (n: CanvasNode) => (isOrchestratorNode(n, p.orchestrator) ? 2 : n.id === t.active ? 1 : 0);
    return rank(a) - rank(b);
  });
  return (
    <>
      {list.map((n) => {
        const target = termTarget(n);
        const at = p.pos[n.id];
        if (!target || !at) return null;
        return (
          <TerminalWindow
            key={n.id} node={n} pos={at} target={target} term={p.term}
            active={t.active === n.id} focusN={t.focusN} maximized={t.maximized === n.id} resuming={t.resuming === n.ref} stats={p.stats[n.ref]}
            selected={p.selected.has(n.id)}
            dim={(p.focus.size > 0 && !p.focus.has(n.id) && t.active !== n.id) || (p.pastAlive !== null && !p.pastAlive.has(n.id))}
            running={n.kind === 'session' && p.running.has(n.ref)} waiting={n.kind === 'session' && p.waiting.has(n.ref)}
            orchestrator={isOrchestratorNode(n, p.orchestrator)}
            promptDisabled={t.resumedLive.has(n.ref)}
            past={p.past} instant={p.instant}
            onPointerDown={p.onPointerDown} onActivate={t.focus} onCollapse={t.collapse} onKill={t.kill}
            onMaximize={t.setMaximized} onResume={t.resume} onOpenChat={p.onOpenChat}
            // Stable reference (useCockpit's onSendTo has empty-ish deps) + the
            // node's own ref (a primitive string) instead of a per-node inline
            // closure — an unstable function prop here would defeat
            // TerminalWindow's memo on every pan/zoom/stats-poll re-render
            // (canvas review #593 item 10).
            onSendTo={p.onSendTo}
            sendError={p.sendError?.sessionId === n.ref ? p.sendError : null} onDismissSendError={p.onDismissSendError}
          />
        );
      })}
    </>
  );
}
