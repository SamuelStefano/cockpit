import { useMemo, useState } from 'react';
import { CARD_STATUSES, type CanvasCard, type CardStatus, type SessionPeek, type TermStats } from '../../../shared/canvas';
import { Badge, Button } from '../../components/primitives';
import { cardRun } from './canvas-board';
import { STATUS_HINT, STATUS_LABEL } from './canvas-labels';
import { KanbanCard } from './KanbanCard';
import { KanbanItemDrawer } from './KanbanItemDrawer';
import { KanbanSessionItem } from './KanbanSessionItem';
import { triageSessionItems, type SessionKanbanItem } from './kanban-items';

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
  // Manual dismiss on top of the automatic staleness triage below — a session
  // Samuel closed from the drawer never comes back on its own.
  hiddenSessionIds: Set<string>;
  onHideSession: (sessionId: string) => void;
  onUnhideAll: () => void;
  sessionPeeks: Record<string, SessionPeek | null>;
  onSessionPeek: (sessionId: string) => void;
}

export function Kanban(p: Props) {
  const [over, setOver] = useState<CardStatus | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [antigosOpen, setAntigosOpen] = useState(false);

  const shownItems = useMemo(() => p.sessionItems.filter((s) => !p.hiddenSessionIds.has(s.sessionId)), [p.sessionItems, p.hiddenSessionIds]);
  // sessionItems is unscoped by design (every session ever, not the canvas
  // scope filter) — without this, "Done" fills with hundreds of sessions
  // nobody is ever going to review (Samuel feedback, 2026-09-24).
  const triage = useMemo(() => triageSessionItems(shownItems, Date.now()), [shownItems]);

  const selectSession = (nodeId: string, sessionId: string) => {
    p.onSelectSession(nodeId);
    setOpenSessionId(sessionId);
  };
  const openItem = openSessionId
    ? triage.visible.find((s) => s.sessionId === openSessionId) ?? triage.staleDone.find((s) => s.sessionId === openSessionId)
    ?? (p.orchestratorItem?.sessionId === openSessionId ? p.orchestratorItem : undefined)
    : undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 md:overflow-hidden">
      {p.orchestratorItem && (
        <KanbanSessionItem
          item={p.orchestratorItem} orchestrator stats={p.termStats[p.orchestratorItem.sessionId]}
          selected={p.selected.includes(p.orchestratorItem.nodeId)}
          onSelect={(nodeId) => selectSession(nodeId, p.orchestratorItem!.sessionId)} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
          onComplete={() => {}}
        />
      )}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 md:grid-cols-4 md:overflow-hidden">
      {CARD_STATUSES.map((status) => {
        const cards = p.cards.filter((c) => c.status === status).sort((a, b) => b.updatedAt - a.updatedAt);
        const sessions = triage.visible.filter((s) => s.status === status).sort((a, b) => b.mtime - a.mtime);
        // "In progress" gets its own fuchsia sub-lane for whoever the
        // Orchestrator delegated to — those never blend into Samuel's own
        // running sessions (canvas review, 2026-09-24).
        const orchChildren = status === 'doing' ? sessions.filter((s) => s.orchestratorChild) : [];
        const own = status === 'doing' ? sessions.filter((s) => !s.orchestratorChild) : sessions;
        const staleDone = status === 'review' ? triage.staleDone : [];
        const empty = !cards.length && !sessions.length && !staleDone.length;
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
              {orchChildren.length > 0 && (
                <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/[0.04] p-1">
                  <div className="px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fuchsia-400">Orchestrator</div>
                  <div className="space-y-1.5">
                    {orchChildren.map((s) => (
                      <KanbanSessionItem
                        key={s.nodeId} item={s} stats={p.termStats[s.sessionId]} selected={p.selected.includes(s.nodeId)}
                        onSelect={(nodeId) => selectSession(nodeId, s.sessionId)} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
                        onComplete={(id) => p.onSessionStatus(id, 'done')}
                      />
                    ))}
                  </div>
                </div>
              )}
              {own.map((s) => (
                <KanbanSessionItem
                  key={s.nodeId} item={s} stats={p.termStats[s.sessionId]} selected={p.selected.includes(s.nodeId)}
                  onSelect={(nodeId) => selectSession(nodeId, s.sessionId)} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
                  onComplete={(id) => p.onSessionStatus(id, 'done')}
                />
              ))}
              {staleDone.length > 0 && (
                <div className="rounded-lg border border-neutral-800 bg-neutral-950/40">
                  <button
                    type="button" onClick={() => setAntigosOpen((v) => !v)}
                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[10.5px] text-neutral-500 hover:text-neutral-300"
                  >
                    <span>{antigosOpen ? '▾' : '▸'} antigos</span>
                    <Badge>{staleDone.length}</Badge>
                  </button>
                  {antigosOpen && (
                    <div className="space-y-1.5 px-1 pb-1.5">
                      {staleDone.map((s) => (
                        <KanbanSessionItem
                          key={s.nodeId} item={s} stats={p.termStats[s.sessionId]} selected={p.selected.includes(s.nodeId)}
                          onSelect={(nodeId) => selectSession(nodeId, s.sessionId)} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
                          onComplete={(id) => p.onSessionStatus(id, 'done')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {empty && <p className="px-1 py-3 text-center text-[11px] text-neutral-600">nada por aqui</p>}
            </div>
          </section>
        );
      })}
      </div>
      {(triage.hiddenIdle.length > 0 || p.hiddenSessionIds.size > 0) && (
        <div className="flex shrink-0 items-center gap-2 px-1 text-[10.5px] text-neutral-600">
          {triage.hiddenIdle.length > 0 && <span>{triage.hiddenIdle.length} sessões antigas sem pendência, fora do quadro</span>}
          {p.hiddenSessionIds.size > 0 && (
            <>
              <span>{p.hiddenSessionIds.size} ocultas manualmente</span>
              <Button variant="ghost" size="sm" onClick={p.onUnhideAll}>mostrar tudo</Button>
            </>
          )}
        </div>
      )}
      {openItem && (
        <KanbanItemDrawer
          item={openItem} stats={p.termStats[openItem.sessionId]} onClose={() => setOpenSessionId(null)}
          peek={p.sessionPeeks[openItem.sessionId]} onPeek={p.onSessionPeek}
          onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
          onMove={(id, status) => p.onSessionStatus(id, status)}
          onHide={(id) => { p.onHideSession(id); setOpenSessionId(null); }}
        />
      )}
    </div>
  );
}
