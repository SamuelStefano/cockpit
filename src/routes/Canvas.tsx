import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CanvasFlow } from '../../shared/canvas';
import { EmptyState } from '../components/primitives';
import { usePersisted } from '../lib/persist';
import { countHotContext, countWaiting } from './canvas/canvas-alerts';
import { neighbors } from './canvas/canvas-filter';
import { newFlowId } from './canvas/canvas-board';
import { AreaBudgetEditor } from './canvas/AreaBudgetEditor';
import { aliveAt } from './canvas/canvas-timeline';
import { CanvasFilters } from './canvas/CanvasFilters';
import { CanvasHud } from './canvas/CanvasHud';
import { CanvasInspector, type ConflictInfo } from './canvas/CanvasInspector';
import { CanvasLoadingState } from './canvas/CanvasLoadingState';
import { CanvasSurface } from './canvas/CanvasSurface';
import { CanvasTimeline } from './canvas/CanvasTimeline';
import { CardEditor } from './canvas/CardEditor';
import { FlowEditor } from './canvas/FlowEditor';
import { Kanban } from './canvas/Kanban';
import { KanbanDock } from './canvas/KanbanDock';
import { CanvasAnalysis } from './canvas/CanvasAnalysis';
import { useCardTerminalAutoOpen } from './canvas/useCardTerminalAutoOpen';
import { useTermStatsPoll } from './canvas/useTermStatsPoll';
import { useTimeline } from './canvas/useTimeline';
import { TerminalMaximized } from './canvas/TerminalMaximized';
import { useCanvasRoute, type CanvasRouteProps } from './canvas/useCanvasRoute';
import { MAX_OPEN_TERMS } from './canvas/canvas-terms';
import { termTarget, useCanvasTerms } from './canvas/useCanvasTerms';

export function Canvas(p: CanvasRouteProps) {
  const terms = useCanvasTerms(p.term, p.discoveredTerms, p.listTerms);
  const r = useCanvasRoute(p, terms.open, terms.shells);
  const [center, setCenter] = useState<{ id: string; n: number } | null>(null);
  const [dockOpen, setDockOpen] = usePersisted('canvas.kanbanOpen', false);
  // Depending on `r` (a fresh object every render) would recreate focusNode —
  // and everything it's passed to (CanvasHud, CanvasInspector, Kanban) —
  // every render. r.select itself is a stable useCallback.
  const { select, clearSelection } = r;
  const focusNode = useCallback((id: string) => {
    select(id, false);
    setCenter((c) => ({ id, n: (c?.n ?? 0) + 1 }));
  }, [select]);
  const linked = useCallback((id: string) => [...neighbors(r.merged.edges, id)].map((x) => r.byId.get(x)!).filter(Boolean), [r.merged.edges, r.byId]);
  const card = useCallback((id: string) => p.board.cards.find((c) => c.id === id), [p.board.cards]);
  const node = useCallback((id: string) => r.byId.get(id), [r.byId]);
  const conflictsOf = useCallback((id: string): ConflictInfo[] => r.merged.edges
    .filter((e) => e.kind === 'conflict' && (e.source === id || e.target === id))
    .map((e) => ({ other: r.byId.get(e.source === id ? e.target : e.source), files: e.files ?? [] }))
    .filter((c): c is ConflictInfo => !!c.other), [r.merged.edges, r.byId]);
  const { blur } = terms;

  // Flow editor: opened either by dragging a port onto another node
  // (openFlowDraft) or by clicking an existing arrow/list entry (editFlow).
  const [flowEdit, setFlowEdit] = useState<{ flow: CanvasFlow; isNew: boolean } | null>(null);
  const openFlowDraft = useCallback((from: string, to: string) => {
    const now = Date.now();
    setFlowEdit({ isNew: true, flow: { id: newFlowId(now, Math.random()), from, to, template: '', enabled: true, createdAt: now, fires: 0 } });
  }, []);
  const editFlow = useCallback((id: string) => {
    const f = p.board.flows.find((x) => x.id === id);
    if (f) setFlowEdit({ flow: f, isNew: false });
  }, [p.board.flows]);
  const saveFlow = useCallback((flow: CanvasFlow) => { p.onCanvasFlowSave(flow); setFlowEdit(null); }, [p]);
  const deleteFlow = useCallback((id: string) => { p.onCanvasFlowDelete(id); setFlowEdit(null); }, [p]);
  const clearAll = useCallback(() => { clearSelection(); blur(); }, [clearSelection, blur]);

  const [timelineNow] = useState(() => Date.now());
  const timeline = useTimeline(timelineNow);
  // Alive sessions at the scrubbed instant, then their touched contexts/cards
  // (mirrors canvas-filter's own "seed then include neighbours" shape) — null
  // while live means "nothing extra to dim".
  const pastAlive = useMemo(() => {
    if (timeline.live) return null;
    const aliveSessions = new Set<string>();
    for (const n of r.visible.nodes) {
      if (n.kind === 'session' && aliveAt(n, timeline.t, p.runStart[n.ref])) aliveSessions.add(n.id);
    }
    const out = new Set(aliveSessions);
    for (const e of r.visible.edges) {
      if (aliveSessions.has(e.source)) out.add(e.target);
      if (aliveSessions.has(e.target)) out.add(e.source);
    }
    return out;
  }, [timeline.live, timeline.t, r.visible.nodes, r.visible.edges, p.runStart]);

  // Live sessions show up as terminals on their own; ghosts wait for a click.
  const { autoOpen } = terms;
  useEffect(() => {
    autoOpen(r.visible.nodes.filter((n) => n.kind === 'session' && p.running.has(n.ref)).map((n) => n.id));
  }, [r.visible.nodes, p.running, autoOpen]);

  const { openWindow } = terms;
  const openTerm = useCallback((id: string) => {
    openWindow(id);
    setCenter((c) => ({ id, n: (c?.n ?? 0) + 1 }));
  }, [openWindow]);

  const openRecent = () => terms.openMany(
    r.visible.nodes.filter((n) => n.kind === 'session').sort((a, b) => a.mtime - b.mtime).slice(-MAX_OPEN_TERMS).map((n) => n.id),
  );

  // A card's run becomes a real (marker-bound) session sometime after the turn
  // starts — open its terminal so whoever is watching the card doesn't have
  // to hunt for it. See useCardTerminalAutoOpen for the full why (persisted
  // baseline seeding, autoAdd-not-capOpen, saved-position guard).
  useCardTerminalAutoOpen(p.board.cards, r.merged.edges, r.pos, p.board.pos, p.onCanvasPos, autoOpen, !!p.graph && p.graph.builtAt > 0);

  const windowNodes = useMemo(() => r.visible.nodes.filter((n) => r.windows.has(n.id)), [r.visible.nodes, r.windows]);
  useTermStatsPoll(windowNodes, p.connected, p.onTermStats);
  const [analysisOn, setAnalysisOn] = usePersisted('canvas.analysisOn', false);
  const pickWindow = useCallback((id: string) => {
    terms.focus(id);
    setCenter((c) => ({ id, n: (c?.n ?? 0) + 1 }));
  }, [terms]);

  const sessionsN = r.visible.nodes.filter((n) => n.kind === 'session').length;
  const contextsN = r.visible.nodes.filter((n) => n.kind === 'context').length;
  const waitingN = countWaiting(r.visible.nodes, r.waiting);
  const hotContextN = countHotContext(windowNodes, p.termStats);
  const conflictsN = r.visible.edges.filter((e) => e.kind === 'conflict').length;
  const maxNode = terms.maximized ? r.byId.get(terms.maximized) : undefined;
  const maxTarget = maxNode && termTarget(maxNode);

  const kanban = (
    <Kanban
      cards={p.board.cards} selected={r.selected} running={p.running} sessionsOf={r.cardSessions}
      onSelect={(id) => (r.mode === 'canvas' && p.graph ? focusNode(`k:${id}`) : r.editCard(id))} onMove={r.setStatus}
      onRun={r.runCard} onEdit={r.editCard} onOpenSession={p.onOpenSession}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <CanvasFilters
        mode={r.mode} onMode={r.setMode} scope={r.scope} onScope={r.setScope} archived={r.archived} onArchived={r.setArchived}
        query={r.query} onQuery={r.setQuery} loading={p.loading} onRefresh={p.onCanvasGet}
        onNewCard={() => r.newDraft('task', r.selectedNodes)}
        counts={{
          sessions: sessionsN, contexts: contextsN, terminals: r.windows.size, cards: p.board.cards.length,
          waiting: waitingN, hotContext: hotContextN, conflicts: conflictsN,
        }}
        areaCounts={r.areaCounts} areaFilter={r.areaFilter} onAreaFilter={r.setAreaFilter}
      />
      {!p.connected ? (
        <EmptyState icon="circle" title="Desconectado" description="Reconecte pra montar o canvas." />
      ) : r.mode === 'kanban' ? (
        <div className="flex min-h-0 flex-1 flex-col">{kanban}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {!p.graph ? (
            <CanvasLoadingState loadingSince={p.loadingSince} stale={p.stale} onRetry={p.onCanvasGet} />
          ) : (
            <CanvasSurface
              nodes={r.visible.nodes} edges={r.visible.edges} pos={r.pos} bounds={r.worldBounds} initialBounds={r.coreBounds}
              selected={r.selected} running={p.running} waiting={r.waiting} centerRequest={center}
              onSelect={r.select} onClear={clearAll} onDrop={r.onDrop} onResetLayout={p.onCanvasPosReset}
              windows={r.windows} terms={terms} term={p.term} onOpenTerm={openTerm} onOpenChat={p.onOpenSession} onOpenRecent={openRecent}
              onSendTo={p.onSendTo} sendError={p.canvasSendError} onDismissSendError={p.dismissCanvasSendError}
              stats={p.termStats} analysisOn={analysisOn} onToggleAnalysis={() => setAnalysisOn(!analysisOn)}
              flows={p.board.flows} flowFired={p.canvasFlowFired} onFlowCreate={openFlowDraft} onFlowClick={editFlow}
              areaRects={r.areaRects} budgetStatus={r.budgetStatus} onEditBudget={r.setBudgetEditArea}
              pastAlive={pastAlive}
            >
              <CanvasHud sessions={p.sessions} running={p.running} onPick={(id) => focusNode(`s:${id}`)} />
              {r.selectedNodes.length > 0 && (
                <CanvasInspector
                  nodes={r.selectedNodes} linked={linked} node={node} card={card} running={p.running} flows={p.board.flows}
                  conflictsOf={conflictsOf}
                  onPick={focusNode} onOpenSession={p.onOpenSession} onOpenTerm={openTerm}
                  onNewCard={(kind) => r.newDraft(kind, r.selectedNodes)} onEditCard={r.editCard}
                  onRunCard={r.runCard} onEditFlow={editFlow} onChainSelected={openFlowDraft} onClose={r.clearSelection}
                />
              )}
              {analysisOn && (
                <CanvasAnalysis nodes={windowNodes} stats={p.termStats} running={p.running} onPick={pickWindow} onClose={() => setAnalysisOn(false)} />
              )}
              {maxNode && maxTarget && (
                <TerminalMaximized node={maxNode} target={maxTarget} term={p.term} onClose={() => terms.setMaximized(null)} />
              )}
            </CanvasSurface>
          )}
          {p.graph && <CanvasTimeline timeline={timeline} />}
          <KanbanDock cards={p.board.cards} open={dockOpen} onToggle={() => setDockOpen(!dockOpen)}>{kanban}</KanbanDock>
        </div>
      )}
      {r.draft && (
        <CardEditor
          key={r.draft.card.id} card={r.draft.card} isNew={r.draft.isNew} node={(id) => r.byId.get(id)}
          onSave={r.saveCard} onRun={r.runCard} onDelete={r.deleteCard} onClose={() => r.setDraft(null)}
        />
      )}
      {flowEdit && (
        <FlowEditor
          key={flowEdit.flow.id} flow={flowEdit.flow} isNew={flowEdit.isNew} node={node}
          onSave={saveFlow} onDelete={deleteFlow} onClose={() => setFlowEdit(null)}
        />
      )}
      {r.budgetEditArea && (
        <AreaBudgetEditor
          key={r.budgetEditArea} area={r.budgetEditArea} budget={p.board.budgets[r.budgetEditArea]}
          onSave={r.saveBudget} onClose={() => r.setBudgetEditArea(null)}
        />
      )}
    </div>
  );
}
