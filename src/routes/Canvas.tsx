import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../components/primitives';
import { usePersisted } from '../lib/persist';
import { neighbors } from './canvas/canvas-filter';
import { CanvasFilters } from './canvas/CanvasFilters';
import { CanvasHud } from './canvas/CanvasHud';
import { CanvasInspector } from './canvas/CanvasInspector';
import { CanvasLoadingState } from './canvas/CanvasLoadingState';
import { CanvasSurface } from './canvas/CanvasSurface';
import { CardEditor } from './canvas/CardEditor';
import { Kanban } from './canvas/Kanban';
import { KanbanDock } from './canvas/KanbanDock';
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
  const { blur } = terms;
  const clearAll = useCallback(() => { clearSelection(); blur(); }, [clearSelection, blur]);

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

  const sessionsN = r.visible.nodes.filter((n) => n.kind === 'session').length;
  const contextsN = r.visible.nodes.filter((n) => n.kind === 'context').length;
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
        counts={{ sessions: sessionsN, contexts: contextsN, terminals: r.windows.size, cards: p.board.cards.length }}
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
            >
              <CanvasHud sessions={p.sessions} running={p.running} onPick={(id) => focusNode(`s:${id}`)} />
              {r.selectedNodes.length > 0 && (
                <CanvasInspector
                  nodes={r.selectedNodes} linked={linked} card={card} running={p.running}
                  onPick={focusNode} onOpenSession={p.onOpenSession} onOpenTerm={openTerm}
                  onNewCard={(kind) => r.newDraft(kind, r.selectedNodes)} onEditCard={r.editCard}
                  onRunCard={r.runCard} onClose={r.clearSelection}
                />
              )}
              {maxNode && maxTarget && (
                <TerminalMaximized node={maxNode} target={maxTarget} term={p.term} onClose={() => terms.setMaximized(null)} />
              )}
            </CanvasSurface>
          )}
          <KanbanDock cards={p.board.cards} open={dockOpen} onToggle={() => setDockOpen(!dockOpen)}>{kanban}</KanbanDock>
        </div>
      )}
      {r.draft && (
        <CardEditor
          key={r.draft.card.id} card={r.draft.card} isNew={r.draft.isNew} node={(id) => r.byId.get(id)}
          onSave={r.saveCard} onRun={r.runCard} onDelete={r.deleteCard} onClose={() => r.setDraft(null)}
        />
      )}
    </div>
  );
}
