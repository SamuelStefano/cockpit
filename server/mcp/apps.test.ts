import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'node:path';

const FIXTURE = join(__dirname, 'fixture-server.mjs');

vi.mock('../admin-ops', () => ({
  managedEnvSync: () => ({}),
  mcpServerDefsSync: () => ({
    'deck-fixture': { command: process.execPath, args: [FIXTURE] },
    'sem-ui': { command: process.execPath, args: ['-e', 'process.exit(0)'] },
  }),
}));

const { parseMcpToolName, isUiMime, resolveApp, clearAppCache } = await import('./apps');

describe('parseMcpToolName', () => {
  it('separa server e tool pelo separador duplo', () => {
    expect(parseMcpToolName('mcp__deck-fixture__counter')).toEqual({ server: 'deck-fixture', tool: 'counter' });
  });

  it('preserva underscore simples no nome da tool', () => {
    expect(parseMcpToolName('mcp__supabase__execute_sql')).toEqual({ server: 'supabase', tool: 'execute_sql' });
  });

  it('ignora tool nativa', () => {
    expect(parseMcpToolName('Bash')).toBeUndefined();
    expect(parseMcpToolName('Agent')).toBeUndefined();
  });

  it('ignora nome malformado', () => {
    expect(parseMcpToolName('mcp__soservidor')).toBeUndefined();
    expect(parseMcpToolName('mcp____vazio')).toBeUndefined();
  });
});

describe('isUiMime', () => {
  it('aceita o profile da spec com espaçamento variável', () => {
    expect(isUiMime('text/html;profile=mcp-app')).toBe(true);
    expect(isUiMime('text/html; profile=mcp-app')).toBe(true);
    expect(isUiMime('TEXT/HTML;PROFILE=MCP-APP')).toBe(true);
  });

  it('recusa html comum — sem o profile não é MCP App', () => {
    expect(isUiMime('text/html')).toBe(false);
    expect(isUiMime('application/json')).toBe(false);
    expect(isUiMime(undefined)).toBe(false);
  });
});

describe('resolveApp', () => {
  beforeEach(() => clearAppCache());

  it('lê o recurso ui:// de um server MCP real', async () => {
    const app = await resolveApp('mcp__deck-fixture__counter');
    expect(app?.uri).toBe('ui://deck-fixture/counter.html');
    expect(app?.html).toContain('MCP App rodando dentro do Deck');
  });

  it('devolve undefined para tool sem UI declarada', async () => {
    expect(await resolveApp('mcp__deck-fixture__inexistente')).toBeUndefined();
  });

  it('devolve undefined para tool nativa, sem abrir sessão', async () => {
    expect(await resolveApp('Bash')).toBeUndefined();
  });

  it('não explode quando o server morre na conexão', async () => {
    expect(await resolveApp('mcp__sem-ui__qualquer')).toBeUndefined();
  });

  it('serve do cache na segunda chamada', async () => {
    const a = await resolveApp('mcp__deck-fixture__counter');
    const b = await resolveApp('mcp__deck-fixture__counter');
    expect(b?.html).toBe(a?.html);
  });
}, 30_000);
