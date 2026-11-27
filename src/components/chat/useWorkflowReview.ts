import { useState } from 'react';
import type { ToolCall } from '../../data/types';
import { workflowApprovalPrompt } from './permission-deny';

export type WorkflowDecision = 'approved' | 'denied' | null;

export function useWorkflowReview(tool: ToolCall, reviewable: boolean, onApprove?: (text: string) => boolean | void) {
  const [decision, setDecision] = useState<WorkflowDecision>(null);
  const [showScript, setShowScript] = useState(true);
  const locked = !reviewable || decision !== null || !onApprove;

  const approve = () => {
    if (locked) return;
    // Same as the question card: offline, "aprovado · rodando de novo" was shown
    // for an approval that never left.
    if (onApprove(workflowApprovalPrompt(tool)) !== false) setDecision('approved');
  };
  const deny = () => { if (!locked) setDecision('denied'); };
  const toggleScript = () => setShowScript((s) => !s);

  return { decision, showScript, locked, approve, deny, toggleScript };
}
