import { describe, expect, it } from 'vitest';
import { permissionDeniedTool } from './permission-deny';

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
