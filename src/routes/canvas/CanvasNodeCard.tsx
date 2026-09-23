import { memo } from 'react';
import type { CanvasNode, CanvasPos } from '../../../shared/canvas';
import { Badge, Button, Icon, type IconName } from '../../components/primitives';
import { relPast } from '../../../shared/format';
import { NODE_H, NODE_W } from './canvas-layout';
import { STATUS_LABEL, STATUS_TONE, titleSize } from './canvas-labels';

interface Props {
  node: CanvasNode;
  pos: CanvasPos;
  selected: boolean;
  dim: boolean;
  running: boolean;
  waiting: boolean;
  compact: boolean;
  zoom: number;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onOpenTerm: (id: string) => void;
}

const FAR_ZOOM = 0.3;

const ICON: Record<CanvasNode['kind'], IconName> = { session: 'terminal', context: 'file', card: 'check', shell: 'terminal' };

function frame(n: CanvasNode, selected: boolean): string {
  if (selected) return 'border-orange-400 ring-2 ring-orange-500/40';
  if (n.kind === 'card') return 'border-orange-500/40';
  if (n.hub) return 'border-orange-500/60';
  return 'border-neutral-700/80';
}

function StateDot({ running, waiting, archived }: { running: boolean; waiting: boolean; archived?: boolean }) {
  if (running) return <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-400" title="rodando" />;
  if (waiting) return <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-400" title="esperando você" />;
  return <span className={`h-2 w-2 shrink-0 rounded-full ${archived ? 'bg-neutral-700' : 'bg-neutral-500'}`} title={archived ? 'arquivada' : 'idle'} />;
}

export const CanvasNodeCard = memo(function CanvasNodeCard({ node: n, pos, selected, dim, running, waiting, compact, zoom, onPointerDown, onOpenTerm }: Props) {
  return (
    <div
      data-node={n.id}
      onPointerDown={(e) => onPointerDown(e, n.id)}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, width: NODE_W, height: compact ? undefined : NODE_H, minHeight: compact ? 44 : undefined }}
      className={`absolute left-0 top-0 touch-none cursor-grab select-none rounded-xl border bg-neutral-900/95 shadow-lg shadow-black/40 transition-opacity active:cursor-grabbing
        ${frame(n, selected)} ${dim ? 'opacity-25' : ''} ${n.archived ? 'opacity-60' : ''}`}
    >
      <div className={`flex items-center gap-1.5 rounded-t-xl border-b border-neutral-800 px-2.5 py-1.5 ${n.hub ? 'bg-orange-500/10' : 'bg-neutral-950/70'}`}>
        {n.kind === 'session'
          ? <StateDot running={running} waiting={waiting} archived={n.archived} />
          : <Icon name={n.hub ? 'layers' : ICON[n.kind]} size={12} className={n.kind === 'card' || n.hub ? 'text-orange-400' : 'text-neutral-500'} />}
        <span className={`min-w-0 flex-1 truncate font-medium ${n.hub ? 'text-orange-200' : 'text-neutral-100'}`} style={{ fontSize: titleSize(zoom) }}>{n.title}</span>
        {n.kind === 'card' && n.status && <Badge tone={STATUS_TONE[n.status]}>{STATUS_LABEL[n.status]}</Badge>}
        {n.kind === 'session' && !compact && (
          <span onPointerDown={(e) => e.stopPropagation()} className="-my-1 -mr-1.5">
            <Button variant="ghost" size="sm" square icon="terminal" title="abrir o terminal desta sessão" onClick={() => onOpenTerm(n.id)} />
          </span>
        )}
      </div>
      {n.hub && zoom < FAR_ZOOM && (
        <span
          className="pointer-events-none absolute bottom-full left-0 whitespace-nowrap font-semibold text-orange-300"
          style={{ fontSize: 13 / zoom, marginBottom: 6 / zoom }}
        >{n.title.replace(/^hub[-_]/, '')}</span>
      )}
      {!compact && (
        <div className="px-2.5 py-1.5">
          <p className="line-clamp-2 text-[11px] leading-snug text-neutral-400">{n.subtitle || '—'}</p>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] text-neutral-600">
            <span>{n.kind === 'session' ? 'sessão' : n.kind === 'context' ? (n.hub ? 'hub' : 'contexto') : 'card'}</span>
            <span>·</span>
            <span>{relPast(n.mtime)}</span>
            {n.archived && <><span>·</span><span>arquivo</span></>}
          </div>
        </div>
      )}
    </div>
  );
});
