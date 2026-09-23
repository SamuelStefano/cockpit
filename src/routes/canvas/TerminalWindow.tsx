import { lazy, memo, Suspense } from 'react';
import type { CanvasNode, CanvasPos } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import type { TermApi } from '../../useCockpit';
import { TERM_H, TERM_W } from './canvas-terms';
import type { TermTarget } from './useCanvasTerms';

const XtermView = lazy(() => import('../../components/Xterm').then((m) => ({ default: m.XtermView })));

interface Props {
  node: CanvasNode;
  pos: CanvasPos;
  target: TermTarget;
  term: TermApi;
  active: boolean;
  focusN: number;
  maximized: boolean;
  selected: boolean;
  dim: boolean;
  running: boolean;
  waiting: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onActivate: (id: string) => void;
  onCollapse: (id: string) => void;
  onKill: (n: CanvasNode) => void;
  onMaximize: (id: string) => void;
  onResume: (sessionId: string) => void;
  onOpenChat: (sessionId: string) => void;
}

const stop = (e: React.PointerEvent) => e.stopPropagation();

function Dot({ running, waiting }: { running: boolean; waiting: boolean }) {
  if (running) return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400" title="rodando" />;
  if (waiting) return <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-400" title="esperando você" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-600" title="inativa" />;
}

// A live tmux pane placed on the map. The title bar drags the window; the body
// belongs to the terminal only once activated, so an idle window never eats the
// wheel or a click meant for panning the canvas.
export const TerminalWindow = memo(function TerminalWindow(p: Props) {
  const n = p.node;
  const session = n.kind === 'session';
  return (
    <div
      data-node={n.id}
      style={{ transform: `translate(${p.pos.x}px, ${p.pos.y}px)`, width: TERM_W, height: TERM_H }}
      className={`absolute left-0 top-0 flex flex-col overflow-hidden rounded-lg border bg-[#0a0a0a] shadow-2xl shadow-black/60 transition-opacity
        ${p.active ? 'border-orange-500/80 ring-2 ring-orange-500/30' : p.selected ? 'border-orange-400/60' : 'border-neutral-700'}
        ${p.dim ? 'opacity-40' : ''}`}
    >
      <header
        onPointerDown={(e) => p.onPointerDown(e, n.id)}
        onDoubleClick={() => p.onMaximize(n.id)}
        className="flex h-8 shrink-0 cursor-grab touch-none select-none items-center gap-1.5 border-b border-neutral-800 bg-neutral-900 pl-2.5 pr-1 active:cursor-grabbing"
      >
        {session ? <Dot running={p.running} waiting={p.waiting} /> : <Icon name="terminal" size={12} className="text-orange-400" />}
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-neutral-200">{n.title}</span>
        {session
          ? <Badge tone={p.running ? 'green' : 'neutral'}>{p.running ? 'ao vivo' : 'fantasma'}</Badge>
          : <Badge tone="orange">shell</Badge>}
        <span onPointerDown={stop} className="flex items-center">
          {session && (
            <Button
              variant="ghost" size="sm" icon="play" disabled={p.running}
              title={p.running ? 'rodando no Deck agora — retomar aqui abriria um segundo escritor' : 'ctrl-c no follow e claude --resume nesta sessão'}
              onClick={() => p.onResume(n.ref)}
            >retomar</Button>
          )}
          {session && <Button variant="ghost" size="sm" square icon="message" title="abrir o chat" onClick={() => p.onOpenChat(n.ref)} />}
          <Button variant="ghost" size="sm" square icon="maximize" title="tela cheia" onClick={() => p.onMaximize(n.id)} />
          {session && <Button variant="ghost" size="sm" square icon="minimize" title="recolher (tmux segue vivo)" onClick={() => p.onCollapse(n.id)} />}
          <Button variant="ghost" size="sm" square icon="x" title="matar a sessão tmux" onClick={() => p.onKill(n)} />
        </span>
      </header>
      <div className="relative min-h-0 flex-1" data-term-active={p.active || undefined}>
        {p.maximized ? (
          <div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">em tela cheia</div>
        ) : (
          <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-600">abrindo terminal…</div>}>
            <XtermView id={p.target.termId} watch={p.target.watch} term={p.term} autoFocus={false} focusKey={p.active ? p.focusN : 0} />
          </Suspense>
        )}
        {!p.active && (
          <div
            className="absolute inset-0 cursor-text"
            title="clique pra digitar"
            onPointerDown={(e) => { e.stopPropagation(); p.onActivate(n.id); }}
          />
        )}
      </div>
    </div>
  );
});
