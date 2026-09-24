import { useEffect, useMemo, useState } from 'react';
import { CARD_STATUSES, type CanvasCard, type CardStatus, type SessionPeek, type TermStats } from '../../../shared/canvas';
import { Badge, Button, Segmented, ToggleChip } from '../../components/primitives';
import { cardRun } from './canvas-board';
import { STATUS_HINT, STATUS_LABEL } from './canvas-labels';
import { KanbanCard } from './KanbanCard';
import { KanbanItemDrawer } from './KanbanItemDrawer';
import { KanbanSessionItem } from './KanbanSessionItem';
import { triageSessionItems, type SessionKanbanItem } from './kanban-items';
import { useArmed } from '../../components/primitives/useArmed';

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
  // Done column bulk triage ("completar antigos (N)", canvas review item 2) —
  // ONE wire frame for the whole batch. Optional so a caller not yet wired
  // through (Canvas.tsx needs one added prop line — see the PR body) still
  // compiles; falls back to one onSessionStatus call per id, which is still
  // correct, just not the single-write path.
  onSessionStatusBulk?: (sessionIds: string[], status: CardStatus) => void;
  // Manual dismiss on top of the automatic staleness triage below — a session
  // Samuel closed from the drawer never comes back on its own.
  hiddenSessionIds: Set<string>;
  onHideSession: (sessionId: string) => void;
  onUnhideAll: () => void;
  sessionPeeks: Record<string, SessionPeek | null>;
  onSessionPeek: (sessionId: string) => void;
}

// Below `md`, one column at a time (canvas review item 11) — a 2×2 grid at
// 390px left every column too narrow to read and clipped its own action row.
const MOBILE_STATUSES = CARD_STATUSES;

export function Kanban(p: Props) {
  const [over, setOver] = useState<CardStatus | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [antigosOpen, setAntigosOpen] = useState(false);
  const [mobileStatus, setMobileStatus] = useState<CardStatus>('doing');

  const shownItems = useMemo(() => p.sessionItems.filter((s) => !p.hiddenSessionIds.has(s.sessionId)), [p.sessionItems, p.hiddenSessionIds]);
  // 12d: own 60s ticker — triageSessionItems used to be memoised on
  // `shownItems` only, so an item crossing the 24h stale line stayed visible
  // until something ELSE happened to re-render this component.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  // sessionItems is unscoped by design (every session ever, not the canvas
  // scope filter) — without this, "Done" fills with hundreds of sessions
  // nobody is ever going to review (Samuel feedback, 2026-09-24).
  const triage = useMemo(() => triageSessionItems(shownItems, now), [shownItems, now]);

  const counts = useMemo(() => {
    const out: Record<CardStatus, number> = { todo: 0, doing: 0, review: 0, done: 0 };
    for (const c of p.cards) out[c.status]++;
    for (const s of triage.visible) out[s.status]++;
    return out;
  }, [p.cards, triage.visible]);

  // Rails only make sense NEXT to a column with content: with every column
  // empty, four 44px rails hugged the left edge of a blank board and nothing
  // said "empty". Then they stay full columns, each with "nada por aqui".
  const boardEmpty = CARD_STATUSES.every((s) => counts[s] === 0) && triage.staleDone.length === 0;

  const selectSession = (nodeId: string, sessionId: string) => {
    p.onSelectSession(nodeId);
    setOpenSessionId(sessionId);
  };
  const openItem = openSessionId
    ? triage.visible.find((s) => s.sessionId === openSessionId) ?? triage.staleDone.find((s) => s.sessionId === openSessionId)
    ?? (p.orchestratorItem?.sessionId === openSessionId ? p.orchestratorItem : undefined)
    : undefined;

  // "completar antigos (N)": ONE wire frame when the caller has wired
  // onSessionStatusBulk through; a per-id loop otherwise (still correct,
  // just N writes instead of 1 — see the Props comment).
  // One tap moved N sessions to done; it now arms first.
  const bulk = useArmed();
  const completeStale = () => {
    const ids = triage.staleDone.map((s) => s.sessionId);
    if (!ids.length) return;
    if (p.onSessionStatusBulk) p.onSessionStatusBulk(ids, 'done');
    else for (const id of ids) p.onSessionStatus(id, 'done');
    setAntigosOpen(false);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 md:overflow-hidden">
      {p.orchestratorItem && (
        <KanbanSessionItem
          item={p.orchestratorItem} orchestrator stats={p.termStats[p.orchestratorItem.sessionId]}
          selected={p.selected.includes(p.orchestratorItem.nodeId)}
          onSelect={(nodeId) => selectSession(nodeId, p.orchestratorItem!.sessionId)} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
        />
      )}
      <div className="shrink-0 md:hidden">
        <Segmented
          label="coluna do kanban" value={mobileStatus} onChange={setMobileStatus}
          items={MOBILE_STATUSES.map((s) => ({ id: s, label: `${STATUS_LABEL[s]} · ${counts[s]}` }))}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row md:overflow-hidden">
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
        const rail = empty && !boardEmpty;
        const isMobileActive = status === mobileStatus;
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
              // Same rule as the drawer: a session is only moved by hand to
              // review/done — To do and In progress come from real activity.
              else if (sessionId && (status === 'review' || status === 'done')) p.onSessionStatus(sessionId, status);
            }}
            className={`${isMobileActive ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col rounded-xl border bg-neutral-950/60 md:flex ${
              rail ? 'md:w-11 md:min-w-11 md:max-w-11 md:flex-none md:items-center' : 'md:min-w-0 md:flex-1'
            } ${over === status ? 'border-orange-500/60' : 'border-neutral-800'}`}
          >
            {rail ? (
              <>
                {/* Below md this IS the active column (nothing else is on
                    screen to save space from) — normal header + "nada por
                    aqui" body. From md up, an empty column collapses to a
                    ~44px rail so In progress/Done keep the width (item 5). */}
                <header className="flex items-center gap-2 px-2.5 py-2 md:hidden" title={STATUS_HINT[status]}>
                  <span className="text-[11.5px] font-semibold text-neutral-200">{STATUS_LABEL[status]}</span>
                  <Badge>0</Badge>
                </header>
                <header className="hidden shrink-0 flex-col items-center gap-1 py-2 text-[10px] text-neutral-500 md:flex" title={STATUS_HINT[status]}>
                  <Badge>0</Badge>
                  <span className="[writing-mode:vertical-rl]">{STATUS_LABEL[status]}</span>
                </header>
              </>
            ) : (
              <header className="flex items-center gap-2 px-2.5 py-2" title={STATUS_HINT[status]}>
                <span className="text-[11.5px] font-semibold text-neutral-200">{STATUS_LABEL[status]}</span>
                <Badge>{cards.length + sessions.length}</Badge>
                {status === 'review' && staleDone.length > 0 && (
                  <ToggleChip on={antigosOpen} icon="clock" onClick={() => setAntigosOpen((v) => !v)} className="ml-auto">
                    {staleDone.length} antigos
                  </ToggleChip>
                )}
              </header>
            )}
            {!empty && status === 'review' && staleDone.length > 0 && (
              <div className="border-b border-neutral-800 px-2 py-1.5">
                <Button size="sm" variant={bulk.armed ? 'primary' : 'secondary'} icon="check" onClick={() => bulk.fire(completeStale)}>
                  {bulk.armed ? `marcar ${staleDone.length} como concluídas?` : `completar antigos (${staleDone.length})`}
                </Button>
              </div>
            )}
            <div className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2 ${rail ? 'md:hidden' : ''}`}>
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
                      />
                    ))}
                  </div>
                </div>
              )}
              {own.map((s) => (
                <KanbanSessionItem
                  key={s.nodeId} item={s} stats={p.termStats[s.sessionId]} selected={p.selected.includes(s.nodeId)}
                  onSelect={(nodeId) => selectSession(nodeId, s.sessionId)} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
                />
              ))}
              {antigosOpen && staleDone.length > 0 && (
                <div className="space-y-1.5 border-t border-neutral-800 pt-1.5">
                  {staleDone.map((s) => (
                    <KanbanSessionItem
                      key={s.nodeId} item={s} stats={p.termStats[s.sessionId]} selected={p.selected.includes(s.nodeId)}
                      onSelect={(nodeId) => selectSession(nodeId, s.sessionId)} onOpenSession={p.onOpenSession} onOpenTerm={p.onOpenTerm}
                    />
                  ))}
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
