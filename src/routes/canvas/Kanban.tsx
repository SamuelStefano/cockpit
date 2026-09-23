import { useState } from 'react';
import { CARD_STATUSES, type CanvasCard, type CardStatus } from '../../../shared/canvas';
import { Badge } from '../../components/primitives';
import { cardRun } from './canvas-board';
import { STATUS_LABEL } from './canvas-labels';
import { KanbanCard } from './KanbanCard';

interface Props {
  cards: CanvasCard[];
  selected: string[];
  running: Set<string>;
  sessionsOf: (id: string) => string[];
  onSelect: (id: string) => void;
  onMove: (id: string, status: CardStatus) => void;
  onRun: (card: CanvasCard) => void;
  onEdit: (id: string) => void;
  onOpenSession: (id: string) => void;
}

export function Kanban(p: Props) {
  const [over, setOver] = useState<CardStatus | null>(null);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-2 md:grid-cols-4 md:overflow-hidden">
      {CARD_STATUSES.map((status) => {
        const cards = p.cards.filter((c) => c.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
        return (
          <section
            key={status}
            onDragOver={(e) => { e.preventDefault(); setOver(status); }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/deck-card'); if (id) p.onMove(id, status); }}
            className={`flex min-h-0 flex-col rounded-xl border bg-neutral-950/60 ${over === status ? 'border-orange-500/60' : 'border-neutral-800'}`}
          >
            <header className="flex items-center gap-2 px-2.5 py-2">
              <span className="text-[11.5px] font-semibold text-neutral-200">{STATUS_LABEL[status]}</span>
              <Badge>{cards.length}</Badge>
            </header>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
              {cards.map((c) => {
                const sessions = p.sessionsOf(c.id);
                return (
                  <KanbanCard
                    key={c.id} card={c} sessions={sessions} run={cardRun(c, sessions, p.running)}
                    selected={p.selected.includes(`k:${c.id}`)} onSelect={p.onSelect} onRun={p.onRun} onEdit={p.onEdit}
                    onReview={(id) => p.onMove(id, 'review')} onOpenSession={p.onOpenSession}
                  />
                );
              })}
              {!cards.length && <p className="px-1 py-3 text-center text-[11px] text-neutral-600">arraste um card pra cá</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
