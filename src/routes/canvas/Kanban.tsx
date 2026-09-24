import { useState } from 'react';
import { CARD_STATUSES, type CanvasCard, type CardStatus, type TermStats } from '../../../shared/canvas';
import { Badge } from '../../components/primitives';
import { cardRun } from './canvas-board';
import { STATUS_HINT, STATUS_LABEL } from './canvas-labels';
import { KanbanCard } from './KanbanCard';
import { KanbanSessionItem } from './KanbanSessionItem';
import type { SessionKanbanItem } from './kanban-items';

interface Props {
  cards: CanvasCard[];
  sessionItems: SessionKanbanItem[];
  // Pinned above the columns — never one of the 4, see kanban-items.ts
  // orchestratorKanbanItem. Undefined when no orchestrator is configured or
  // its session hasn't shown up on the canvas yet.
  orchestratorItem?: SessionKanbanItem;
  termStats: Record<string, TermStats>;
  selected: string[];
  running: Set<string>;
  sessionsOf: (id: string) => string[];
  nodeOf: (id: string) => { title: string; subtitle: string } | undefined;
  onSelect: (id: string) => void;
  onSelectSession: (nodeId: string) => void;
  onMove: (id: string, status: CardStatus) => void;
  onRun: (card: CanvasCard) => void;
  onEdit: (id: string) => void;
  onOpenSession: (id: string) => void;
  onOpenTerm: (nodeId: string) => void;
  onSessionStatus: (sessionId: string, status: CardStatus) => void;
}

export function Kanban(p: Props) {
  const [over, setOver] = useState<CardStatus | null>(null);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 md:overflow-hidden">
      {p.orchestratorItem && (
        <KanbanSessionItem
          item={p.orchestratorItem} orchestrator stats={p.termStats[p.orchestratorItem.sessionId]}
          selected={p.selected.includes(p.orchestratorItem.nodeId)}
          onSelect={p.onSelectSession} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
          onComplete={() => {}}
        />
      )}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 md:grid-cols-4 md:overflow-hidden">
      {CARD_STATUSES.map((status) => {
        const cards = p.cards.filter((c) => c.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
        const sessions = p.sessionItems.filter((s) => s.status === status).sort((a, b) => b.mtime - a.mtime);
        const empty = !cards.length && !sessions.length;
        return (
          <section
            key={status}
            onDragOver={(e) => { e.preventDefault(); setOver(status); }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => {
              e.preventDefault(); setOver(null);
              const cardId = e.dataTransfer.getData('text/deck-card');
              const sessionId = e.dataTransfer.getData('text/deck-session');
              if (cardId) p.onMove(cardId, status);
              else if (sessionId) p.onSessionStatus(sessionId, status);
            }}
            className={`flex min-h-0 flex-col rounded-xl border bg-neutral-950/60 ${over === status ? 'border-orange-500/60' : 'border-neutral-800'}`}
          >
            <header className="flex items-center gap-2 px-2.5 py-2" title={STATUS_HINT[status]}>
              <span className="text-[11.5px] font-semibold text-neutral-200">{STATUS_LABEL[status]}</span>
              <Badge>{cards.length + sessions.length}</Badge>
            </header>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
              {cards.map((c) => {
                const boundIds = p.sessionsOf(c.id);
                const lastSession = boundIds.length ? p.nodeOf(boundIds[boundIds.length - 1]) : undefined;
                return (
                  <KanbanCard
                    key={c.id} card={c} sessions={boundIds} run={cardRun(c, boundIds, p.running)} sessionSummary={lastSession}
                    selected={p.selected.includes(`k:${c.id}`)} onSelect={p.onSelect} onRun={p.onRun} onEdit={p.onEdit}
                    onReview={(id) => p.onMove(id, 'review')} onOpenSession={p.onOpenSession}
                  />
                );
              })}
              {sessions.map((s) => (
                <KanbanSessionItem
                  key={s.nodeId} item={s} stats={p.termStats[s.sessionId]} selected={p.selected.includes(s.nodeId)}
                  onSelect={p.onSelectSession} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
                  onComplete={(id) => p.onSessionStatus(id, 'done')}
                />
              ))}
              {empty && <p className="px-1 py-3 text-center text-[11px] text-neutral-600">nada por aqui</p>}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
