import type { CanvasNode } from '../../../shared/canvas';
import { AreaBudgetEditor } from './AreaBudgetEditor';
import { CardEditor } from './CardEditor';
import { FlowEditor } from './FlowEditor';
import type { CanvasRoute, CanvasRouteProps } from './useCanvasRoute';
import type { FlowEdit } from './useCanvasFlowEditor';

interface Props {
  p: CanvasRouteProps;
  r: CanvasRoute;
  node: (id: string) => CanvasNode | undefined;
  flowEdit: FlowEdit | null;
  onSaveFlow: (flow: FlowEdit['flow']) => void;
  onDeleteFlow: (id: string) => void;
  onCloseFlow: () => void;
}

// The three modal editors the canvas can open: card, flow and area budget.
export function CanvasEditors({ p, r, node, flowEdit, onSaveFlow, onDeleteFlow, onCloseFlow }: Props) {
  return (
    <>
      {r.draft && (
        <CardEditor
          key={r.draft.card.id} card={r.draft.card} isNew={r.draft.isNew} node={node}
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
          onSave={onSaveFlow} onDelete={onDeleteFlow} onClose={onCloseFlow}
        />
      )}
      {r.budgetEditArea && (
        <AreaBudgetEditor
          key={r.budgetEditArea} area={r.budgetEditArea} budget={p.board.budgets[r.budgetEditArea]}
          onSave={r.saveBudget} onClose={() => r.setBudgetEditArea(null)}
        />
      )}
    </>
  );
}
