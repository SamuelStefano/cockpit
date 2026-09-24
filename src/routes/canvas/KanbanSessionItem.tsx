import { memo } from 'react';
import { AREA_LABELS, type TermStats } from '../../../shared/canvas';
import { lastSeenLabel } from '../../../shared/format';
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
}

// 2 rows (canvas review item 5: title+badges / area·time·ctx — was 4 rows
// plus a 3-button row, ~4.5 items fit a screen). Terminal/chat only show on
// hover/focus on desktop; a tap opens the drawer instead (Kanban.tsx), which
// carries both actions plus everything else, so touch never loses them. The
// per-item "marcar completo" button is gone — the bulk "completar antigos"
// action and the drawer's own status control cover it now.
export const KanbanSessionItem = memo(function KanbanSessionItem({ item, stats, selected, orchestrator, onSelect, onOpenSession, onOpenTerm }: Props) {
  const pct = stats ? ctxPct(stats) : null;
  const badge = item.needsAttention
    ? { tone: 'red' as const, text: 'precisa de atenção' }
    : item.waitingOnUser
    ? { tone: 'yellow' as const, text: 'esperando você' }
    : item.running
    ? { tone: 'green' as const, text: 'rodando', dot: true }
    : null;
  return (
    <div
      draggable={!orchestrator} tabIndex={0} role="button"
      onDragStart={(e) => { e.dataTransfer.setData('text/deck-session', item.sessionId); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => onSelect(item.nodeId)}
      // Only the item itself: Enter on the inner terminal/chat buttons is theirs.
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(item.nodeId); } }}
      title={item.subtitle}
      className={`group rounded-lg border px-2.5 py-2 ${orchestrator ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${
        orchestrator ? 'border-fuchsia-500/60 bg-fuchsia-500/[0.08]' : selected ? 'border-orange-400/70 bg-neutral-900/70' : 'border-neutral-800 bg-neutral-900/70 hover:border-neutral-700'}`}
    >
      <div className="flex items-start gap-1.5">
        <Icon name={orchestrator ? 'command' : 'terminal'} size={12} className={`mt-0.5 shrink-0 ${orchestrator ? 'text-fuchsia-400' : 'text-neutral-500'}`} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-snug text-neutral-200">{item.title}</span>
        {orchestrator && <Badge tone="purple">ORCHESTRATOR</Badge>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500">
        {item.area && <span className="rounded border border-neutral-700 px-1 py-0.5 text-neutral-400">{AREA_LABELS[item.area]}</span>}
        <span>{item.running ? 'ativa agora' : lastSeenLabel(item.mtime)}</span>
        {pct !== null && stats?.contextTokens !== undefined && <span>ctx {fmtTokens(stats.contextTokens)} ({pct}%)</span>}
        {badge && <Badge tone={badge.tone} dot={badge.dot}>{badge.text}</Badge>}
        <div
          className="ml-auto flex gap-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="sm" variant="ghost" icon="terminal" title="abrir terminal" onClick={() => onOpenTerm(item.nodeId)} />
          <Button size="sm" variant="ghost" icon="message" title="abrir chat" onClick={() => onOpenSession(item.sessionId)} />
        </div>
      </div>
    </div>
  );
});
