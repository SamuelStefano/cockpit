import { useCallback, useState } from 'react';
import type { CanvasFlow } from '../../../shared/canvas';
import { newFlowId } from './canvas-board';
import type { CanvasRouteProps } from './useCanvasRoute';

export interface FlowEdit { flow: CanvasFlow; isNew: boolean }

// Flow editor state: opened either by dragging a port onto another node
// (openFlowDraft) or by clicking an existing arrow/list entry (editFlow).
export function useCanvasFlowEditor(p: Pick<CanvasRouteProps, 'board' | 'onCanvasFlowSave' | 'onCanvasFlowDelete'>) {
  const [flowEdit, setFlowEdit] = useState<FlowEdit | null>(null);
  const { flows } = p.board;
  const { onCanvasFlowSave, onCanvasFlowDelete } = p;
  const openFlowDraft = useCallback((from: string, to: string) => {
    const now = Date.now();
    setFlowEdit({ isNew: true, flow: { id: newFlowId(now, Math.random()), from, to, template: '', enabled: true, createdAt: now, fires: 0 } });
  }, []);
  const editFlow = useCallback((id: string) => {
    const f = flows.find((x) => x.id === id);
    if (f) setFlowEdit({ flow: f, isNew: false });
  }, [flows]);
  const saveFlow = useCallback((flow: CanvasFlow) => { onCanvasFlowSave(flow); setFlowEdit(null); }, [onCanvasFlowSave]);
  const deleteFlow = useCallback((id: string) => { onCanvasFlowDelete(id); setFlowEdit(null); }, [onCanvasFlowDelete]);
  const closeFlow = useCallback(() => setFlowEdit(null), []);
  return { flowEdit, openFlowDraft, editFlow, saveFlow, deleteFlow, closeFlow };
}
