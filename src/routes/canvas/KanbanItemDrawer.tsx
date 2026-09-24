import { useEffect } from 'react';
import { AREA_LABELS, CARD_STATUSES, type CardStatus, type SessionPeek, type TermStats } from '../../../shared/canvas';
import { relPast } from '../../../shared/format';
import { Badge, Button, Icon } from '../../components/primitives';
import { STATUS_LABEL, STATUS_TONE } from './canvas-labels';
import { ctxPct, fmtTokens } from './term-stats-view';
import type { SessionKanbanItem } from './kanban-items';

interface Props {
  item: SessionKanbanItem;
  stats?: TermStats;
  // undefined = not fetched yet, null = transcript unreadable.
  peek?: SessionPeek | null;
  onPeek: (sessionId: string) => void;
  onClose: () => void;
  onOpenSession: (id: string) => void;
  onOpenTerm: (nodeId: string) => void;
  onMove: (sessionId: string, status: CardStatus) => void;
  onHide: (sessionId: string) => void;
}

// The kanban's own detail panel (canvas review, 2026-09-24: "a card must be
// clickable"). Deliberately NOT CanvasInspector — that one needs the whole
// graph (linked nodes, flows) and only mounts inside CanvasSurface, which
// isn't there in the dedicated kanban tab. The last assistant message and
// the transcript's PRs/links come from a 'canvas-session-peek' read
// (server/sessions/peek.ts), refetched whenever the session moves.
export function KanbanItemDrawer({ item, stats, peek, onPeek, onClose, onOpenSession, onOpenTerm, onMove, onHide }: Props) {
  const pct = stats ? ctxPct(stats) : null;
  useEffect(() => { onPeek(item.sessionId); }, [onPeek, item.sessionId, item.mtime]);
  return (
    <aside className="absolute inset-x-3 bottom-3 z-20 flex max-h-[60vh] flex-col overflow-hidden rounded-2xl border border-neutral-700/80 bg-neutral-900/95 shadow-xl backdrop-blur-md sm:inset-x-auto sm:right-3 sm:w-80">
      <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
        <Icon name="terminal" size={13} className="shrink-0 text-neutral-500" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-neutral-100">{item.title}</span>
        <Button variant="ghost" size="sm" icon="x" onClick={onClose} title="fechar" />
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          {item.area && <Badge>{AREA_LABELS[item.area]}</Badge>}
          {item.running && <Badge tone="green" dot>rodando</Badge>}
          {item.waitingOnUser && <Badge tone="yellow">esperando você</Badge>}
          {item.needsAttention && <Badge tone="red">precisa de atenção</Badge>}
        </div>
        {item.subtitle && (
          <div>
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Primeira mensagem</div>
            <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-neutral-400">{item.subtitle}</p>
          </div>
        )}
        {peek?.lastAssistant && (
          <div>
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">
              Last message{peek.lastAt !== undefined && <span className="normal-case"> · {relPast(peek.lastAt)}</span>}
            </div>
            <p className="whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-neutral-300">{peek.lastAssistant}</p>
          </div>
        )}
        {peek && (peek.prs.length > 0 || peek.links.length > 0) && (
          <div>
            <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-neutral-500">Links</div>
            <ul className="space-y-0.5 text-[11.5px]">
              {peek.prs.map((pr) => (
                <li key={pr.url}><a href={pr.url} target="_blank" rel="noopener noreferrer" className="text-fuchsia-300 hover:underline">{pr.label}</a></li>
              ))}
              {peek.links.map((url) => (
                <li key={url} className="truncate"><a href={url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline" title={url}>{url}</a></li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
          <span>{item.running ? 'ativa agora' : `parada há ${relPast(item.mtime)}`}</span>
          {pct !== null && stats?.contextTokens !== undefined && <span>ctx {fmtTokens(stats.contextTokens)} ({pct}%)</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-neutral-800 px-3 py-2.5">
        <Button size="sm" icon="terminal" onClick={() => onOpenTerm(item.nodeId)}>terminal</Button>
        <Button variant="secondary" size="sm" icon="message" onClick={() => onOpenSession(item.sessionId)}>abrir chat</Button>
        {CARD_STATUSES.filter((s) => s !== item.status).map((s) => (
          <Button key={s} variant="secondary" size="sm" onClick={() => onMove(item.sessionId, s)}>mover p/ {STATUS_LABEL[s]}</Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => onHide(item.sessionId)}>ocultar</Button>
      </div>
    </aside>
  );
}
