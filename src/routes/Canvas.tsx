import { useCallback, useState } from 'react';
import { Badge, EmptyState, RouteHeader } from '../components/primitives';
import { neighbors } from './canvas/canvas-filter';
import { CanvasFilters } from './canvas/CanvasFilters';
import { CanvasHud } from './canvas/CanvasHud';
import { CanvasInspector } from './canvas/CanvasInspector';
import { CanvasLoadingState } from './canvas/CanvasLoadingState';
import { CanvasSurface } from './canvas/CanvasSurface';
import { CardEditor } from './canvas/CardEditor';
import { Kanban } from './canvas/Kanban';
import { useCanvasRoute, type CanvasRouteProps } from './canvas/useCanvasRoute';

export function Canvas(p: CanvasRouteProps) {
  const r = useCanvasRoute(p);
  const [center, setCenter] = useState<{ id: string; n: number } | null>(null);
  // Depending on `r` (a fresh object every render) would recreate focusNode —
  // and everything it's passed to (CanvasHud, CanvasInspector, Kanban) —
  // every render. r.select itself is a stable useCallback.
  const { select } = r;
  const focusNode = useCallback((id: string) => {
    select(id, false);
    setCenter((c) => ({ id, n: (c?.n ?? 0) + 1 }));
  }, [select]);
  const linked = useCallback((id: string) => [...neighbors(r.merged.edges, id)].map((x) => r.byId.get(x)!).filter(Boolean), [r.merged.edges, r.byId]);
  const card = useCallback((id: string) => p.board.cards.find((c) => c.id === id), [p.board.cards]);

  const showCanvas = r.mode !== 'kanban';
  const showKanban = r.mode !== 'canvas';
  const sessionsN = r.visible.nodes.filter((n) => n.kind === 'session').length;
  const contextsN = r.visible.nodes.filter((n) => n.kind === 'context').length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <RouteHeader
        variant="bar" title="canvas" icon="layers"
        badge={<Badge tone="neutral">{sessionsN} sessões · {contextsN} contextos · {p.board.cards.length} cards</Badge>}
        subtitle="sessões × contextos · orquestrador de agentes · kanban · conteúdo"
      />
      <CanvasFilters
        mode={r.mode} onMode={r.setMode} scope={r.scope} onScope={r.setScope} archived={r.archived} onArchived={r.setArchived}
        query={r.query} onQuery={r.setQuery} loading={p.loading} onRefresh={p.onCanvasGet}
        onNewCard={() => r.newDraft('task', r.selectedNodes)}
      />
      {!p.connected ? (
        <EmptyState icon="circle" title="Desconectado" description="Reconecte pra montar o canvas." />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {showCanvas && (
            <div className={`flex min-h-0 flex-col ${showKanban ? 'flex-[3]' : 'flex-1'}`}>
              {!p.graph ? (
                <CanvasLoadingState loadingSince={p.loadingSince} stale={p.stale} onRetry={p.onCanvasGet} />
              ) : (
                <CanvasSurface
                  nodes={r.visible.nodes} edges={r.visible.edges} pos={r.pos} bounds={r.worldBounds} initialBounds={r.coreBounds}
                  selected={r.selected} running={p.running} waiting={r.waiting} centerRequest={center}
                  onSelect={r.select} onClear={r.clearSelection} onDrop={p.onCanvasPos} onResetLayout={p.onCanvasPosReset}
                >
                  <CanvasHud sessions={p.sessions} running={p.running} onPick={(id) => focusNode(`s:${id}`)} />
                  {r.selectedNodes.length > 0 && (
                    <CanvasInspector
                      nodes={r.selectedNodes} linked={linked} card={card} running={p.running}
                      onPick={focusNode} onOpenSession={p.onOpenSession}
                      onNewCard={(kind) => r.newDraft(kind, r.selectedNodes)} onEditCard={r.editCard}
                      onRunCard={r.runCard} onClose={r.clearSelection}
                    />
                  )}
                </CanvasSurface>
              )}
            </div>
          )}
          {showKanban && (
            // Cards live on the board, not the graph — they render as soon as
            // canvas-board arrives, without waiting for the (possibly stuck) graph.
            <div className={`flex min-h-0 flex-col border-t border-neutral-800 ${showCanvas ? 'flex-[2]' : 'flex-1'}`}>
              <Kanban
                cards={p.board.cards} selected={r.selected} running={p.running} sessionsOf={r.cardSessions}
                onSelect={(id) => (showCanvas && p.graph ? focusNode(`k:${id}`) : r.editCard(id))} onMove={r.setStatus}
                onRun={r.runCard} onEdit={r.editCard} onOpenSession={p.onOpenSession}
              />
            </div>
          )}
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
