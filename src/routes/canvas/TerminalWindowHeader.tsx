import { useEffect, useState } from 'react';
import type { CanvasNode } from '../../../shared/canvas';
import { Badge, Button, Icon } from '../../components/primitives';
import { AlertBadge } from './CanvasAlert';
import type { AlertKind } from './canvas-alerts';

interface Props {
  node: CanvasNode;
  session: boolean;
  orchestrator: boolean;
  running: boolean;
  waiting: boolean;
  resuming: boolean;
  alert: AlertKind;
  pct: number | null;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onMaximize: (id: string) => void;
  onCollapse: (id: string) => void;
  onKill: (n: CanvasNode) => void;
  onResume: (sessionId: string) => void;
  onOpenChat: (sessionId: string) => void;
  onDock?: () => void;
}

const stop = (e: React.PointerEvent) => e.stopPropagation();

function Dot({ running, waiting }: { running: boolean; waiting: boolean }) {
  if (running) return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400" title="rodando" />;
  if (waiting) return <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-400" title="esperando você" />;
  return <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-600" title="inativa" />;
}

// Drag handle + identity + live status + window controls for one
// TerminalWindow — split out so the window component itself stays under the
// ~150-line UI file cap (CLAUDE.md).
export function TerminalWindowHeader(p: Props) {
  const { node: n } = p;
  // Two taps to kill: the "x" sits next to "recolher" at 28px and the tmux
  // session may be running a worker. The first tap arms it for 3s.
  const [killArmed, setKillArmed] = useState(false);
  useEffect(() => {
    if (!killArmed) return;
    const t = setTimeout(() => setKillArmed(false), 3000);
    return () => clearTimeout(t);
  }, [killArmed]);
  return (
    <header
      onPointerDown={(e) => p.onPointerDown(e, n.id)}
      onDoubleClick={() => p.onMaximize(n.id)}
      className={`flex h-8 shrink-0 cursor-grab touch-none select-none items-center gap-1.5 border-b pl-2.5 pr-1 active:cursor-grabbing ${p.orchestrator ? 'border-fuchsia-500/40 bg-fuchsia-500/10' : 'border-neutral-800 bg-neutral-900'}`}
    >
      {p.orchestrator
        ? <Icon name="command" size={12} className="text-fuchsia-400" />
        : p.session ? <Dot running={p.running} waiting={p.waiting} /> : <Icon name="terminal" size={12} className="text-orange-400" />}
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-neutral-200">{p.orchestrator ? 'Orchestrator' : n.title}</span>
      {p.orchestrator && <Badge tone="purple">ORCHESTRATOR</Badge>}
      {p.alert && <AlertBadge kind={p.alert} pct={p.pct} />}
      {p.session
        ? <Badge tone={p.running ? 'green' : 'neutral'}>{p.running ? 'ao vivo' : 'fantasma'}</Badge>
        : !p.orchestrator && <Badge tone="orange">shell</Badge>}
      <span onPointerDown={stop} onDoubleClick={(e) => e.stopPropagation()} className="flex items-center">
        {p.orchestrator && p.onDock && (
          <Button variant="ghost" size="sm" square icon="panelRight" title="fixar no sidebar (Ctrl+.)" onClick={p.onDock} />
        )}
        {p.session && (
          <Button
            variant="ghost" size="sm" icon="play" disabled={p.running || p.resuming} loading={p.resuming}
            title={p.running ? 'rodando no Deck agora — retomar aqui abriria um segundo escritor' : 'ctrl-c no follow e claude --resume nesta sessão'}
            onClick={() => p.onResume(n.ref)}
          >retomar</Button>
        )}
        {p.session && <Button variant="ghost" size="sm" square icon="message" title="abrir o chat" onClick={() => p.onOpenChat(n.ref)} />}
        <Button variant="ghost" size="sm" square icon="maximize" title="tela cheia" onClick={() => p.onMaximize(n.id)} />
        {p.session && <Button variant="ghost" size="sm" square icon="minimize" title="recolher (tmux segue vivo)" onClick={() => p.onCollapse(n.id)} />}
        {!p.orchestrator && (
          <Button
            variant={killArmed ? 'danger' : 'ghost'} size="sm" square icon="x"
            title={killArmed ? 'toque de novo pra matar a sessão tmux' : 'matar a sessão tmux'}
            aria-label={killArmed ? 'confirmar: matar a sessão tmux' : 'matar a sessão tmux'}
            onClick={() => { if (killArmed) { setKillArmed(false); p.onKill(n); } else setKillArmed(true); }}
          />
        )}
      </span>
    </header>
  );
}
