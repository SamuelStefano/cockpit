// No modo -p o CLI não tem prompt interativo: negação de permissão chega como
// tool_result de erro com este texto fixo. Detectar permite orientar o usuário
// a trocar de modo em vez de mostrar só um "exit 1" genérico.
const DENIAL_RE = /Claude requested permissions to use (.+?), but you haven't granted it/;

export function permissionDeniedTool(output: string[]): string | null {
  for (const line of output) {
    const m = DENIAL_RE.exec(line);
    if (m) return m[1];
  }
  return null;
}

export const WORKFLOW_REVIEW_DENIAL = 'Review dynamic workflow before running';

export function isWorkflowReview(tool: { name: string; status: string; output?: string[] }): boolean {
  return tool.name === 'Workflow'
    && tool.status === 'error'
    && (tool.output ?? []).some((line) => line.includes(WORKFLOW_REVIEW_DENIAL));
}

export function workflowApprovalPrompt(tool: { workflow?: { name?: string; description?: string; scriptPath?: string } }): string {
  const w = tool.workflow;
  const target = w?.name ?? w?.description ?? w?.scriptPath;
  const label = target ? ` "${target}"` : '';
  return `I reviewed and approved the workflow${label}. Run the same Workflow call again now, unchanged.`;
}
