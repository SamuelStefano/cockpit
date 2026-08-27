import { describe, it, expect } from 'vitest';
import { clampNumber, formatContexts, formatSessions, formatSkills, MCP_TOOLS } from './format';

describe('MCP_TOOLS', () => {
  it('has unique names', () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  // Um `required` apontando pra propriedade que não existe passa no tsc e só
  // aparece como argumento faltando em runtime, do lado do cliente.
  it('only requires properties it declares', () => {
    for (const tool of MCP_TOOLS) {
      for (const req of tool.inputSchema.required ?? []) {
        expect(Object.keys(tool.inputSchema.properties)).toContain(req);
      }
    }
  });

  it('describes every tool and every property', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      for (const prop of Object.values(tool.inputSchema.properties)) {
        expect(prop.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('clampNumber', () => {
  it('falls back to the default for anything non-numeric', () => {
    expect(clampNumber(undefined, 30, 200)).toBe(30);
    expect(clampNumber(null, 30, 200)).toBe(30);
    expect(clampNumber('abc', 30, 200)).toBe(30);
    expect(clampNumber(NaN, 30, 200)).toBe(30);
    expect(clampNumber(Infinity, 30, 200)).toBe(30);
  });

  // Todos coagem pra 0 no Number(), e 0 é finito: sem o guard de tipo virariam
  // `min` silenciosamente em vez do default.
  it('does not let falsy non-numbers coerce to zero', () => {
    expect(clampNumber('', 30, 200)).toBe(30);
    expect(clampNumber([], 30, 200)).toBe(30);
    expect(clampNumber(false, 30, 200)).toBe(30);
  });

  it('clamps to the range and floors fractions', () => {
    expect(clampNumber(500, 30, 200)).toBe(200);
    expect(clampNumber(0, 30, 200)).toBe(1);
    expect(clampNumber(-5, 30, 200)).toBe(1);
    expect(clampNumber(12.9, 30, 200)).toBe(12);
  });

  it('accepts a numeric string, since a client may send one', () => {
    expect(clampNumber('50', 30, 200)).toBe(50);
  });
});

describe('formatContexts', () => {
  it('says so when there is nothing', () => {
    expect(formatContexts([])).toBe('Nenhum contexto no memoryDir.');
  });

  it('renders id, type, title and description', () => {
    const out = formatContexts([
      { id: 'handoff-20260826-abcd', title: 'Kanban', description: 'colunas', type: 'reference', mtime: 1 },
      { id: 'perfil', title: 'Perfil', description: '', type: 'user', mtime: 2 },
    ]);
    expect(out).toBe('- handoff-20260826-abcd [reference] Kanban — colunas\n- perfil [user] Perfil');
  });
});

describe('formatSessions', () => {
  it('says so when there is nothing', () => {
    expect(formatSessions([])).toBe('Nenhuma sessão.');
  });

  it('renders summary and snippet only when present', () => {
    const out = formatSessions([
      { id: 'a', title: 'Uma', relative: 'agora', snippet: 'oi', summary: 'fez X', mtime: 2, count: 4 },
      { id: 'b', title: 'Outra', relative: 'ontem', snippet: '', mtime: 1, count: 2 },
    ]);
    expect(out).toBe('- a — Uma (agora, 4 msgs)\n  resumo: fez X\n  trecho: oi\n- b — Outra (ontem, 2 msgs)');
  });
});

describe('formatSkills', () => {
  it('says so when there is nothing', () => {
    expect(formatSkills([])).toBe('Nenhuma skill.');
  });

  it('renders id, name and description', () => {
    const out = formatSkills([{ id: 'deploy', name: 'Deploy', description: 'sobe pra Vercel', mtime: 1 }]);
    expect(out).toBe('- deploy — Deploy: sobe pra Vercel');
  });
});
