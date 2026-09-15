import { describe, expect, it } from 'vitest';
import { permissionDeniedTool, isWorkflowReview, workflowApprovalPrompt } from './permission-deny';

describe('permissionDeniedTool', () => {
  it('extrai o nome da ferramenta negada', () => {
    expect(permissionDeniedTool([
      "Claude requested permissions to use WebFetch, but you haven't granted it yet.",
    ])).toBe('WebFetch');
  });

  it('aceita nomes de MCP com underscores', () => {
    expect(permissionDeniedTool([
      'linha anterior qualquer',
      "Claude requested permissions to use mcp__supabase__execute_sql, but you haven't granted it yet.",
    ])).toBe('mcp__supabase__execute_sql');
  });

  it('retorna null pra erro comum', () => {
    expect(permissionDeniedTool(['command not found: foo', 'exit 127'])).toBeNull();
    expect(permissionDeniedTool([])).toBeNull();
  });
});

describe('isWorkflowReview', () => {
  const denied = { name: 'Workflow', status: 'error', output: ['Review dynamic workflow before running'] };

  it('detects the headless workflow review denial', () => {
    expect(isWorkflowReview(denied)).toBe(true);
  });

  it('ignores other tools, successful runs and unrelated errors', () => {
    expect(isWorkflowReview({ ...denied, name: 'Bash' })).toBe(false);
    expect(isWorkflowReview({ ...denied, status: 'done' })).toBe(false);
    expect(isWorkflowReview({ ...denied, output: ['Invalid workflow script: boom'] })).toBe(false);
    expect(isWorkflowReview({ name: 'Workflow', status: 'error' })).toBe(false);
  });
});

describe('workflowApprovalPrompt', () => {
  it('names the approved workflow', () => {
    expect(workflowApprovalPrompt({ workflow: { description: 'audit PRs' } })).toContain('"audit PRs"');
  });

  it('falls back to a generic approval', () => {
    expect(workflowApprovalPrompt({})).toBe('I reviewed and approved the workflow. Run the same Workflow call again now, unchanged.');
  });
});
