import { memo } from 'react';
import { AREA_LABELS, type TermStats } from '../../../shared/canvas';
import { relPast } from '../../../shared/format';
import { Badge, Button, Icon } from '../../components/primitives';
import { ctxPct, fmtTokens } from './term-stats-view';
import type { SessionKanbanItem } from './kanban-items';

interface Props {
  item: SessionKanbanItem;
  stats?: TermStats;
  selected: boolean;
  // The orchestrator's pinned item (Kanban.tsx) reuses this same card, just
  // with the distinct chrome — never draggable INTO a status column, since
  // it isn't part of the ToDo/Doing/Review/Done set.
  orchestrator?: boolean;
  onSelect: (id: string) => void;
  onOpenSession: (id: string) => void;
  onOpenTerm: (nodeId: string) => void;
  onComplete: (sessionId: string) => void;
}

// Same visual language as KanbanCard (draggable pill, ghost icon + title,
// small meta row) — a plain session without a card behind it, so it never
// has a prompt/format/context list to show, just what it's DOING.
export const KanbanSessionItem = memo(function KanbanSessionItem({ item, stats, selected, orchestrator, onSelect, onOpenSession, onOpenTerm, onComplete }: Props) {
  const pct = stats ? ctxPct(stats) : null;
  return (
    <div
      draggable={!orchestrator}
      onDragStart={(e) => { e.dataTransfer.setData('text/deck-session', item.sessionId); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => onSelect(item.nodeId)}
      className={`rounded-lg border px-2.5 py-2 ${orchestrator ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${
        orchestrator ? 'border-fuchsia-500/60 bg-fuchsia-500/[0.08]' : selected ? 'border-orange-400/70 bg-neutral-900/70' : 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-700'}`}
    >
      <div className="flex items-start gap-1.5">
        <Icon name={orchestrator ? 'command' : 'terminal'} size={12} className={`mt-0.5 shrink-0 ${orchestrator ? 'text-fuchsia-400' : 'text-neutral-500'}`} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-snug text-neutral-200">{item.title}</span>
        {orchestrator && <Badge tone="purple">ORCHESTRATOR</Badge>}
        {item.running && <Badge tone="green" dot>rodando</Badge>}
        {item.waitingOnUser && <Badge tone="yellow">esperando você</Badge>}
        {item.needsAttention && <Badge tone="red">precisa de atenção</Badge>}
      </div>
      {item.subtitle && <p className="mt-1 line-clamp-1 text-[10px] text-neutral-500">{item.subtitle}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
        {item.area && <span className="rounded border border-neutral-700 px-1 py-0.5 text-neutral-400">{AREA_LABELS[item.area]}</span>}
        <span>{item.running ? 'ativa agora' : `parada há ${relPast(item.mtime)}`}</span>
        {pct !== null && stats?.contextTokens !== undefined && <span>ctx {fmtTokens(stats.contextTokens)} ({pct}%)</span>}
      </div>
      <div className="mt-1.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" icon="terminal" title="abrir terminal" onClick={() => onOpenTerm(item.nodeId)} />
        <Button size="sm" variant="ghost" icon="message" title="abrir chat" onClick={() => onOpenSession(item.sessionId)} />
        {!orchestrator && item.status !== 'done' && (
          <Button size="sm" variant="secondary" icon="check" onClick={() => onComplete(item.sessionId)}>marcar completo</Button>
        )}
      </div>
    </div>
  );
});
