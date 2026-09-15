import { useState } from 'react';
import type { ToolCall } from '../../data/types';
import { workflowApprovalPrompt } from './permission-deny';

export type WorkflowDecision = 'approved' | 'denied' | null;

export function useWorkflowReview(tool: ToolCall, reviewable: boolean, onApprove?: (text: string) => void) {
  const [decision, setDecision] = useState<WorkflowDecision>(null);
  const [showScript, setShowScript] = useState(true);
  const locked = !reviewable || decision !== null || !onApprove;

  const approve = () => {
    if (locked) return;
    setDecision('approved');
    onApprove(workflowApprovalPrompt(tool));
  };
  const deny = () => { if (!locked) setDecision('denied'); };
  const toggleScript = () => setShowScript((s) => !s);

  return { decision, showScript, locked, approve, deny, toggleScript };
}
