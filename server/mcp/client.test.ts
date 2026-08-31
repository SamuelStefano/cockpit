import { describe, it, expect, beforeEach, vi } from 'vitest';

let managed: Record<string, string> = {};
vi.mock('../admin-ops', () => ({ managedEnvSync: () => managed, mcpServerDefsSync: () => ({}) }));

const { stdioEnv } = await import('./client');

beforeEach(() => { managed = {}; });

describe('stdioEnv', () => {
  it('passa só o mínimo do processo', () => {
    expect(Object.keys(stdioEnv()).every((k) => ['PATH', 'HOME', 'LANG', 'TMPDIR'].includes(k))).toBe(true);
  });

  // O `claude -p` herda o ambiente inteiro ao subir um MCP stdio; aqui o server só
  // precisa falar JSON-RPC, então segredo solto do backend não pode ir junto.
  it('não vaza segredo solto do processo', () => {
    process.env.DECK_TEST_MCP_SEGREDO = 'nao-vaza';
    expect(stdioEnv().DECK_TEST_MCP_SEGREDO).toBeUndefined();
    delete process.env.DECK_TEST_MCP_SEGREDO;
  });

  it('entrega o env gerenciado, que é onde moram as credenciais dos MCPs', () => {
    managed = { DFL_TOKEN: 'tok' };
    expect(stdioEnv().DFL_TOKEN).toBe('tok');
  });

  it('o env declarado no server vence o gerenciado', () => {
    managed = { DFL_TOKEN: 'do-painel' };
    expect(stdioEnv({ DFL_TOKEN: 'do-server' }).DFL_TOKEN).toBe('do-server');
  });

  it('omite chave de base que não existe no processo em vez de mandar undefined', () => {
    const antes = process.env.TMPDIR;
    delete process.env.TMPDIR;
    expect('TMPDIR' in stdioEnv()).toBe(false);
    if (antes !== undefined) process.env.TMPDIR = antes;
  });
});
