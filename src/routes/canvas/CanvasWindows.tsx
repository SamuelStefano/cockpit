import type { CanvasNode, CanvasPos } from '../../../shared/canvas';
import type { TermApi } from '../../useCockpit';
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
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onOpenChat: (sessionId: string) => void;
}

// The focused window paints last so it is never under a neighbour it overlaps.
export function CanvasWindows(p: Props) {
  const t = p.terms;
  const list = [...p.nodes].sort((a, b) => Number(a.id === t.active) - Number(b.id === t.active));
  return (
    <>
      {list.map((n) => {
        const target = termTarget(n);
        const at = p.pos[n.id];
        if (!target || !at) return null;
        return (
          <TerminalWindow
            key={n.id} node={n} pos={at} target={target} term={p.term}
            active={t.active === n.id} focusN={t.focusN} maximized={t.maximized === n.id}
            selected={p.selected.has(n.id)} dim={p.focus.size > 0 && !p.focus.has(n.id) && t.active !== n.id}
            running={n.kind === 'session' && p.running.has(n.ref)} waiting={n.kind === 'session' && p.waiting.has(n.ref)}
            onPointerDown={p.onPointerDown} onActivate={t.focus} onCollapse={t.collapse} onKill={t.kill}
            onMaximize={t.setMaximized} onResume={t.resume} onOpenChat={p.onOpenChat}
          />
        );
      })}
    </>
  );
}
