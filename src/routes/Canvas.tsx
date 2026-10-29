import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/primitives';
import { usePersisted } from '../lib/persist';
import { countHotContext, summarizeStatus } from './canvas/canvas-alerts';
import { useCanvasLookups } from './canvas/useCanvasLookups';
import { CanvasEditors } from './canvas/CanvasEditors';
import { useCanvasFlowEditor } from './canvas/useCanvasFlowEditor';
import { CanvasChain } from './canvas/CanvasChain';
import { CanvasFilters } from './canvas/CanvasFilters';
import { CanvasHud } from './canvas/CanvasHud';
import { CanvasInspector } from './canvas/CanvasInspector';
import { CanvasLoadingState } from './canvas/CanvasLoadingState';
import { CanvasSurface } from './canvas/CanvasSurface';
import { CanvasTimeline } from './canvas/CanvasTimeline';
import { Kanban } from './canvas/Kanban';
import { KanbanDock } from './canvas/KanbanDock';
import { CanvasAnalysis } from './canvas/CanvasAnalysis';
import { useDflPontos } from './pontos/useDflPontos';
import { useCardTerminalAutoOpen } from './canvas/useCardTerminalAutoOpen';
import { useCanvasPastView } from './canvas/useCanvasPastView';
import { useKanbanCtxPoll } from './canvas/useKanbanCtxPoll';
import { useTermStatsPoll } from './canvas/useTermStatsPoll';
import { TerminalMaximized } from './canvas/TerminalMaximized';
import { useCanvasRoute, type CanvasRouteProps } from './canvas/useCanvasRoute';
import { MAX_OPEN_TERMS, pickRecentSessions } from './canvas/canvas-terms';
import { termTarget, useCanvasTerms } from './canvas/useCanvasTerms';

export function Canvas(p: CanvasRouteProps) {
  const terms = useCanvasTerms(p.term, p.discoveredTerms, p.listTerms);
  const r = useCanvasRoute(p, terms.open, terms.shells);
  // Sessions alive in a `cockpit-cv-*` shell: feeds the "ao vivo" badge and the "sessões" quick-open ranking.
  const cvLive = useMemo(() => new Set(p.cvLiveSessionIds), [p.cvLiveSessionIds]);
  // DFL snapshot for CardEditor's link picker (server push keeps it fresh).
  useDflPontos({ connected: p.connected, onDflGet: p.onDflGet });
  const [center, setCenter] = useState<{ id: string; n: number } | null>(null);
  const [dockOpen, setDockOpen] = usePersisted('canvas.kanbanOpen', false);
  // Destructured: `r` is a fresh object every render, r.select is stable.
  const { select, clearSelection } = r;
  const focusNode = useCallback((id: string) => {
    select(id, false);
    setCenter((c) => ({ id, n: (c?.n ?? 0) + 1 }));
  }, [select]);
  const { linked, card, node, conflictsOf, sessionNodeOf } = useCanvasLookups(r, p);
  const { blur } = terms;

  const { flowEdit, openFlowDraft, editFlow, saveFlow, deleteFlow, closeFlow } = useCanvasFlowEditor(p);
  const clearAll = useCallback(() => { clearSelection(); blur(); }, [clearSelection, blur]);

  const { timeline, pastNodes, pastEdges, pastPos, pastBounds, pastAlive } = useCanvasPastView(r, p);
  const { autoOpen } = terms;
  useEffect(() => {
    autoOpen(r.visible.nodes.filter((n) => n.kind === 'session' && p.running.has(n.ref)).map((n) => n.id));
  }, [r.visible.nodes, p.running, autoOpen]);

  const { openWindow } = terms;
  const openTerm = useCallback((id: string) => {
    openWindow(id);
    setCenter((c) => ({ id, n: (c?.n ?? 0) + 1 }));
  }, [openWindow]);

  // Running-or-cv-live first, then waiting, then hot-context, then most
  // recent (pickRecentSessions, canvas-terms.ts) — replaces the old
  // mtime-only sort, which opened whatever was merely last touched over a
  // session that's actually running in a cv shell right now.
  const runningOrCvLive = useMemo(() => new Set([...p.running, ...cvLive]), [p.running, cvLive]);
  const openRecent = () => terms.openMany(
    pickRecentSessions(r.visible.nodes.filter((n) => n.kind === 'session'), runningOrCvLive, r.waiting, p.termStats, MAX_OPEN_TERMS),
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
  const hotContextN = countHotContext(windowNodes, p.termStats);
  const conflictsN = r.visible.edges.filter((e) => e.kind === 'conflict').length;
  const maxNode = terms.maximized ? r.byId.get(terms.maximized) : undefined;
  const maxTarget = maxNode && termTarget(maxNode);

  const statusSummary = useMemo(() => summarizeStatus(r.sessionItems, Date.now()), [r.sessionItems]);
  // The kanban's ctx% (review item 8): keeps termStats fresh for whatever the
  // kanban actually shows (triaged, ≤40 ids), while it's the visible mode or
  // the bottom dock is open — never while neither is true.
  const ctxPollItems = useMemo(
    () => r.sessionItems.filter((i) => !r.hiddenSessionIdSet.has(i.sessionId)),
    [r.sessionItems, r.hiddenSessionIdSet],
  );
  useKanbanCtxPoll(ctxPollItems, r.mode === 'kanban' || dockOpen, p.onCanvasCtxStats);

  const kanban = (
    <Kanban
      cards={p.board.cards} sessionItems={r.sessionItems} termStats={p.termStats}
      selected={r.selected} running={p.running} sessionsOf={r.cardSessions} nodeOf={sessionNodeOf}
      onSelect={(id) => (r.mode === 'canvas' && p.graph ? focusNode(`k:${id}`) : r.editCard(id))}
      onSelectSession={(nodeId) => (r.mode === 'canvas' && p.graph ? focusNode(nodeId) : r.select(nodeId, false))}
      onMove={r.setStatus} onRun={r.runCard} onEdit={r.editCard} onOpenSession={p.onOpenSession}
      onOpenTerm={openTerm} onSessionStatus={r.onSessionStatus} onSessionStatusBulk={r.onSessionStatusBulk}
      hiddenSessionIds={r.hiddenSessionIdSet} onHideSession={r.hideSession} onUnhideAll={r.unhideAllSessions}
      sessionPeeks={p.sessionPeeks} onSessionPeek={p.onSessionPeek}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 bg-neutral-950">
      {/* min-w-0: a flex item's default min-width is its content's, so the
          kanban's four columns (and the chain's area row) widened the whole
          route past the viewport — "+ card", the Completed column and, on a
          phone, the "filtros" button ended up
          off-screen. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CanvasFilters
          mode={r.mode} onMode={r.setMode} scope={r.scope} onScope={r.setScope} archived={r.archived} onArchived={r.setArchived}
          showAutomation={r.showAutomation} onShowAutomation={r.setShowAutomation}
          showContexts={r.showContexts} onShowContexts={r.setShowContexts}
          query={r.query} onQuery={r.setQuery} loading={p.loading} onRefresh={p.onCanvasGet}
          onNewCard={() => r.newDraft('task', r.selectedNodes)}
          counts={{
            sessions: sessionsN, contexts: contextsN, terminals: r.windows.size, cards: p.board.cards.length,
            hotContext: hotContextN, conflicts: conflictsN,
          }}
          areaCounts={r.areaCounts} areaFilter={r.areaFilter} onAreaFilter={r.setAreaFilter}
          statusSummary={statusSummary} onFocusStatusItem={focusNode}
        />
        {!p.connected ? (
          <EmptyState icon="circle" title="Desconectado" description="Reconecte pra montar o canvas." />
        ) : r.mode === 'kanban' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Same gate the map/chain views already have (review item 12c) —
                without it, kanban rendered with an empty graph for the whole
                first build: four "nada por aqui" columns and a 0 0 0 0 strip. */}
            {!p.graph ? <CanvasLoadingState loadingSince={p.loadingSince} stale={p.stale} onRetry={p.onCanvasGet} /> : kanban}
          </div>
        ) : r.mode === 'chain' ? (
          !p.graph ? (
            <CanvasLoadingState loadingSince={p.loadingSince} stale={p.stale} onRetry={p.onCanvasGet} />
          ) : (
            <CanvasChain
              nodes={r.visible.nodes} flows={p.board.flows} running={p.running} waiting={r.waiting}
              stats={p.termStats}
              onOpenTerm={openTerm} onOpenChat={p.onOpenSession}
            />
          )
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {!p.graph ? (
              <CanvasLoadingState loadingSince={p.loadingSince} stale={p.stale} onRetry={p.onCanvasGet} />
            ) : (
              <CanvasSurface
                nodes={pastNodes} edges={pastEdges} pos={pastPos} bounds={pastBounds} initialBounds={r.coreBounds}
                selected={r.selected} running={p.running} waiting={r.waiting} centerRequest={center}
                onSelect={r.select} onClear={clearAll} onDrop={r.onDrop} onResetLayout={p.onCanvasPosReset}
                windows={r.windows} terms={terms} term={p.term} onOpenTerm={openTerm} onOpenChat={p.onOpenSession} onOpenRecent={openRecent} cvLive={cvLive}
                onSendTo={p.onSendTo} sendError={p.canvasSendError} onDismissSendError={p.dismissCanvasSendError}
                stats={p.termStats} analysisOn={analysisOn} onToggleAnalysis={() => setAnalysisOn(!analysisOn)}
                flows={p.board.flows} flowFired={p.canvasFlowFired} onFlowCreate={openFlowDraft} onFlowClick={editFlow}
                areaRects={r.areaRects} budgetStatus={r.budgetStatus} onEditBudget={r.setBudgetEditArea}
                pastAlive={pastAlive} timelinePlaying={timeline.playing}
              >
                <CanvasHud items={r.sessionItems} onPick={focusNode} />
                {r.selectedNodes.length > 0 && (
                  <CanvasInspector
                    nodes={r.selectedNodes} linked={linked} node={node} card={card} running={p.running} waiting={r.waiting}
                    flows={p.board.flows}
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
            <KanbanDock cards={p.board.cards} sessionItems={r.sessionItems} hiddenSessionIds={r.hiddenSessionIdSet} open={dockOpen} onToggle={() => setDockOpen(!dockOpen)}>{kanban}</KanbanDock>
          </div>
        )}
        <CanvasEditors p={p} r={r} node={node} flowEdit={flowEdit} onSaveFlow={saveFlow} onDeleteFlow={deleteFlow} onCloseFlow={closeFlow} />
      </div>
    </div>
  );
}
