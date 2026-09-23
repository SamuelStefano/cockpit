import { memo } from 'react';
import type { CanvasCard } from '../../../shared/canvas';
import { FORMAT_LABEL } from '../../../shared/canvas-prompt';
import { Badge, Button, Icon } from '../../components/primitives';
import type { CardRun } from './canvas-board';

interface Props {
  card: CanvasCard;
  run: CardRun;
  sessions: string[];
  // Title/subtitle of the card's most recent bound session — the card IS the
  // kanban item for that session (kanban-items.ts dedupes it out of the
  // session-only list), so this is the only place its live summary shows up.
  sessionSummary?: { title: string; subtitle: string };
  selected: boolean;
  onSelect: (id: string) => void;
  onRun: (card: CanvasCard) => void;
  onEdit: (id: string) => void;
  onReview: (id: string) => void;
  onOpenSession: (id: string) => void;
}

export const KanbanCard = memo(function KanbanCard({ card, run, sessions, sessionSummary, selected, onSelect, onRun, onEdit, onReview, onOpenSession }: Props) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/deck-card', card.id); e.dataTransfer.effectAllowed = 'move'; }}
      onClick={() => onSelect(card.id)}
      className={`cursor-grab rounded-lg border bg-neutral-900 px-2.5 py-2 active:cursor-grabbing ${selected ? 'border-orange-400/70' : 'border-neutral-800 hover:border-neutral-700'}`}
    >
      <div className="flex items-start gap-1.5">
        <Icon name={card.kind === 'content' ? 'sparkles' : 'zap'} size={12} className="mt-0.5 shrink-0 text-orange-400" />
        <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-neutral-100">{card.title}</span>
        {run === 'running' && <Badge tone="green" dot>rodando</Badge>}
        {run === 'review' && <Badge tone="yellow">parece pronto</Badge>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-neutral-500">
        {card.kind === 'content' && card.format && <Badge>{FORMAT_LABEL[card.format]}</Badge>}
        {/* dfl.error stays visible even while `pending` retries in the
            background — that's the "sync pendente" badge the card carries
            until the next successful push (server/canvas/dfl-status-sync.ts).
            awaitingConfirm (yellow) is a DIFFERENT state from error (red): a
            review/done push the server refuses to fire without a human
            clicking "confirmar sync" in the editor (billing-relevant status,
            never automatic — statusNeedsHumanConfirm). */}
        {card.dfl && (
          <Badge
            tone={card.dfl.error ? 'red' : card.dfl.awaitingConfirm ? 'yellow' : 'orange'}
            title={card.dfl.error ?? (card.dfl.awaitingConfirm ? 'aguardando confirmação pra sincronizar com a DFL' : 'vinculado a uma task DFL')}
          >
            DFL{card.dfl.error ? ' ⚠' : card.dfl.awaitingConfirm ? ' •' : ''}
          </Badge>
        )}
        {card.contextIds.length > 0 && <span>{card.contextIds.length} ctx</span>}
        {sessions.length > 0 && (
          <button type="button" className="text-orange-300 hover:underline" onClick={(e) => { e.stopPropagation(); onOpenSession(sessions[sessions.length - 1]); }}>
            {sessions.length} sessão{sessions.length > 1 ? 'ões' : ''} ↗
          </button>
        )}
      </div>
      {sessionSummary && <p className="mt-1 line-clamp-1 text-[10px] text-neutral-500">{sessionSummary.title} — {sessionSummary.subtitle}</p>}
      <div className="mt-1.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
        {card.status === 'todo' && <Button size="sm" icon="play" onClick={() => onRun(card)}>rodar</Button>}
        {run === 'review' && <Button size="sm" variant="secondary" icon="check" onClick={() => onReview(card.id)}>marcar como feito</Button>}
        <Button size="sm" variant="ghost" icon="pencil" onClick={() => onEdit(card.id)} title="editar" />
      </div>
    </div>
  );
});
