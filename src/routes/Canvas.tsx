import { useCallback, useEffect, useMemo, useState } from 'react';
import { sessionNodeId, shellNodeId, watchTermId, type CanvasFlow } from '../../shared/canvas';
import { Button, EmptyState } from '../components/primitives';
import { usePersisted } from '../lib/persist';
import { countHotContext, summarizeStatus } from './canvas/canvas-alerts';
import { neighbors } from './canvas/canvas-filter';
import { newFlowId } from './canvas/canvas-board';
import { isOrchestratorNode, orchestratorTermId } from './canvas/orchestrator';
import { OrchestratorDock } from './canvas/OrchestratorDock';
import { useOrchestratorDock } from './canvas/useOrchestratorDock';
import { AreaBudgetEditor } from './canvas/AreaBudgetEditor';
import { CanvasChain } from './canvas/CanvasChain';
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
  const terms = useCanvasTerms(p.term, p.discoveredTerms, p.listTerms, p.graph?.orchestrator?.sessionId);
  const r = useCanvasRoute(p, terms.open, terms.shells);
  // Sessions live in a `cockpit-cv-*` tmux shell right now (#617/#618) — same
  // raw source useCanvasRoute.ts itself folds into its own status derivation,
  // rebuilt here because that hook doesn't expose the Set on its return value.
  // Feeds TerminalWindow's "ao vivo/fantasma" badge (via CanvasSurface below)
  // and the "sessões" quick-open ranking, so both read cv-shell workers as
  // live too, not just p.running.
  const cvLive = useMemo(() => new Set(p.cvLiveSessionIds), [p.cvLiveSessionIds]);
  // Fetches the DFL snapshot CardEditor's link picker needs; the server push
  // (dfl-points-watch.ts) keeps it fresh afterwards, same as /pontos.
  useDflPontos({ connected: p.connected, onDflGet: p.onDflGet });
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
  // Prefers the live terminal window (the actual orchestrator process) over
  // the bare session node — falls back to the session when the shell hasn't
  // shown up on the canvas yet (tmux not (re)discovered since the last poll).
  const orchestratorNodeId = useMemo(() => {
    const info = p.graph?.orchestrator;
    if (!info) return null;
    let sessionNodeId: string | null = null;
    for (const n of r.byId.values()) {
      if (!isOrchestratorNode(n, info)) continue;
      if (n.kind === 'shell') return n.id;
      sessionNodeId = n.id;
    }
    return sessionNodeId;
  }, [p.graph?.orchestrator, r.byId]);
  const orchDock = useOrchestratorDock();
  const onFocusOrchestrator = orchDock.open ? undefined : orchestratorNodeId ? () => focusNode(orchestratorNodeId) : undefined;
  // While docked, the orchestrator's own node is dropped from the map — it's
  // rendered once, in the sidebar, not doubled as a floating window too.
  const dockedNodeId = orchDock.open ? orchestratorNodeId : null;
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

  // Timeline scrub + the "alive at T" node/edge/pos rebuild it drives while
  // scrubbed off "agora" — see useCanvasPastView's own doc for the WHY.
  const { timeline, pastNodes, pastEdges, pastPos, pastBounds, pastAlive } = useCanvasPastView(r, p, dockedNodeId);
  // Live sessions show up as terminals on their own; ghosts wait for a click.
  const { autoOpen } = terms;
  useEffect(() => {
    autoOpen(r.visible.nodes.filter((n) => n.kind === 'session' && p.running.has(n.ref)).map((n) => n.id));
  }, [r.visible.nodes, p.running, autoOpen]);

  // A `w-` follower for the Orchestrator's OWN session is a leftover from
  // before this exclusion existed (or from a backend without it) — kill the
  // real tmux pane, not just hide the local window state, so `tmux ls`
  // matches what the canvas shows. term.kill is idempotent against an id
  // that's already gone.
  const { kill: killTerm } = p.term;
  useEffect(() => {
    const info = p.graph?.orchestrator;
    if (!info) return;
    const followerId = watchTermId(info.sessionId);
    if (p.discoveredTerms.includes(followerId)) killTerm(followerId);
  }, [p.graph?.orchestrator, p.discoveredTerms, killTerm]);

  const { openWindow } = terms;
  const orchestratorSessionNodeId = p.graph?.orchestrator ? sessionNodeId(p.graph.orchestrator.sessionId) : null;
  const { setOpen: setDockOpenFromTerm } = orchDock;
  const openTerm = useCallback((id: string) => {
    // useCanvasTerms silently refuses this id (never a `w-` follower for the
    // Orchestrator's own session — see item B). Route the same click to the
    // ONE real surface instead of doing nothing.
    if (id === orchestratorSessionNodeId) { setDockOpenFromTerm(true); return; }
    openWindow(id);
    setCenter((c) => ({ id, n: (c?.n ?? 0) + 1 }));
  }, [openWindow, orchestratorSessionNodeId, setDockOpenFromTerm]);

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

  const sessionNodeOf = useCallback((sessionId: string) => {
    const n = r.byId.get(`s:${sessionId}`);
    return n ? { title: n.title, subtitle: n.subtitle } : undefined;
  }, [r.byId]);

  // "Who needs me" (review item 1): one derived summary over every session
  // item PLUS the pinned orchestrator item — the orchestrator's own turn
  // counts as "rodando" here even though deriveSessionItems always excludes
  // it from the plain list (Kanban.tsx pins it separately above the columns).
  const statusItems = useMemo(
    () => (r.orchestratorItem ? [...r.sessionItems, r.orchestratorItem] : r.sessionItems),
    [r.sessionItems, r.orchestratorItem],
  );
  const statusSummary = useMemo(() => summarizeStatus(statusItems, Date.now()), [statusItems]);
  // Shared by the status line's chips and the HUD roster's own rows: the
  // orchestrator's node is hidden from the map while docked (dockedNodeId
  // above), so focusing it there would silently do nothing — open the dock
  // instead of trying to center a node that was never rendered.
  const focusOrOpenDock = useCallback((nodeId: string) => {
    if (nodeId === orchestratorSessionNodeId) { setDockOpenFromTerm(true); return; }
    focusNode(nodeId);
  }, [orchestratorSessionNodeId, setDockOpenFromTerm, focusNode]);

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
      cards={p.board.cards} sessionItems={r.sessionItems} orchestratorItem={r.orchestratorItem} termStats={p.termStats}
      selected={r.selected} running={p.running} sessionsOf={r.cardSessions} nodeOf={sessionNodeOf}
      onSelect={(id) => (r.mode === 'canvas' && p.graph ? focusNode(`k:${id}`) : r.editCard(id))}
      onSelectSession={(nodeId) => (r.mode === 'canvas' && p.graph ? focusNode(nodeId) : r.select(nodeId, false))}
      onMove={r.setStatus} onRun={r.runCard} onEdit={r.editCard} onOpenSession={p.onOpenSession}
      onOpenTerm={openTerm} onSessionStatus={r.onSessionStatus} onSessionStatusBulk={r.onSessionStatusBulk}
      hiddenSessionIds={r.hiddenSessionIdSet} onHideSession={r.hideSession} onUnhideAll={r.unhideAllSessions}
      sessionPeeks={p.sessionPeeks} onSessionPeek={p.onSessionPeek}
    />
  );

  const orchestrator = p.graph?.orchestrator;
  return (
    <div className="flex min-h-0 flex-1 bg-neutral-950">
      {/* min-w-0: a flex item's default min-width is its content's, so the
          kanban's four columns (and the chain's area row) widened the whole
          route past the viewport — "+ card", the Completed column and, on a
          phone, the "filtros" button and the orchestrator FAB ended up
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
          statusSummary={statusSummary} onFocusStatusItem={focusOrOpenDock}
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
              stats={p.termStats} orchestrator={p.graph.orchestrator}
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
                pastAlive={pastAlive} timelinePlaying={timeline.playing} orchestrator={p.graph.orchestrator}
                onFocusOrchestrator={onFocusOrchestrator} dockOpen={orchDock.open} onToggleDock={orchestrator ? orchDock.toggle : undefined}
              >
                <CanvasHud items={statusItems} onPick={focusOrOpenDock} />
                {r.selectedNodes.length > 0 && (
                  <CanvasInspector
                    nodes={r.selectedNodes} linked={linked} node={node} card={card} running={p.running} waiting={r.waiting}
                    orchestrator={p.graph.orchestrator} flows={p.board.flows}
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
        {r.draft && (
          <CardEditor
            key={r.draft.card.id} card={r.draft.card} isNew={r.draft.isNew} node={(id) => r.byId.get(id)}
            sessions={r.merged.nodes.filter((n) => n.kind === 'session')} edges={r.merged.edges}
            running={p.running} termStats={p.termStats} onCtxStats={p.onCanvasCtxStats}
            onSave={r.saveCard} onRun={r.runCard} onDelete={r.deleteCard} onClose={() => r.setDraft(null)}
            dflSnapshot={p.dflSnapshot} onDflTaskLink={p.onDflTaskLink}
            onDflTaskCreateLink={p.onDflTaskCreateLink} onDflTaskUnlink={p.onDflTaskUnlink}
            onDflTaskConfirmSync={p.onDflTaskConfirmSync}
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
      {orchestrator && orchDock.open && (
        <OrchestratorDock
          orchestrator={orchestrator} dock={orchDock} term={p.term} stats={p.termStats[orchestratorTermId(orchestrator)]}
          live={r.orchestratorItem?.running ?? false}
          activity={p.orchestratorActivity} onActivityGet={p.onOrchestratorActivityGet}
          onOpenShell={(termId) => openTerm(shellNodeId(termId))}
        />
      )}
      {orchestrator && !orchDock.open && orchDock.mobile && (
        <Button
          variant="primary" size="md" square icon="command" title="abrir o orchestrator"
          onClick={orchDock.toggle}
          className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/40 hover:bg-fuchsia-500"
        />
      )}
    </div>
  );
}
