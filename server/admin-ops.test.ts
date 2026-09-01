import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setEnv, addMcp, installCli, INSTALLABLE, validateMcpUrl, claudeReady } from './admin-ops';

// Cobre os guards que rejeitam ANTES de tocar o disco (#162): validação de nome,
// allow-list de instalação e exigência de alvo do MCP. As escritas reais (env.json,
// ~/.claude.json, npm i -g) são exercitadas ponta-a-ponta; aqui só as bordas puras.

describe('admin-ops guards', () => {
  it('rejeita nome de env inválido sem persistir', async () => {
    expect(await setEnv('bad name', 'v')).toEqual({ ok: false, message: 'nome de env inválido' });
    expect(await setEnv('1LEADING', 'v')).toEqual({ ok: false, message: 'nome de env inválido' });
    expect(await setEnv('has-dash', 'v')).toEqual({ ok: false, message: 'nome de env inválido' });
  });

  it('addMcp exige nome e alvo', async () => {
    expect(await addMcp('', {})).toEqual({ ok: false, message: 'nome do MCP vazio' });
    expect(await addMcp('foo', {})).toEqual({ ok: false, message: 'informe url ou command' });
  });

  it('installCli só aceita a allow-list', async () => {
    expect(await installCli('rm-rf-slash')).toEqual({ ok: false, message: 'rm-rf-slash não está na allow-list' });
    expect(INSTALLABLE).toContain('vercel');
    expect(INSTALLABLE).toContain('supabase');
  });
});

describe('validateMcpUrl (SSRF/exfil no admin-mcp-add)', () => {
  it('aceita https remoto', () => {
    expect(validateMcpUrl('https://plans.mcp.devfellowship.com/mcp').ok).toBe(true);
  });

  it('aceita http só em loopback', () => {
    expect(validateMcpUrl('http://127.0.0.1:8080/mcp').ok).toBe(true);
    expect(validateMcpUrl('http://localhost:3000').ok).toBe(true);
    expect(validateMcpUrl('http://[::1]:9000/x').ok).toBe(true);
  });

  it('rejeita http remoto', () => {
    expect(validateMcpUrl('http://evil.com/mcp')).toEqual({ ok: false, message: 'url do MCP precisa ser https (http só em loopback)' });
  });

  it('rejeita protocolos não-http(s)', () => {
    expect(validateMcpUrl('file:///etc/passwd').ok).toBe(false);
    expect(validateMcpUrl('ftp://host/x').ok).toBe(false);
  });

  it('rejeita credenciais embutidas', () => {
    expect(validateMcpUrl('https://user:pass@evil.com/mcp')).toEqual({ ok: false, message: 'url do MCP não pode conter credenciais' });
  });

  it('rejeita url malformada', () => {
    expect(validateMcpUrl('not a url').ok).toBe(false);
  });
});

// O banner de login é a ÚNICA tela que sabe explicar por que o turno morreu sem
// produzir nada; ele só aparece quando claudeReady() diz false. Um falso "pronto"
// esconde a explicação exatamente no caso em que ela é necessária.
describe('claudeReady', () => {
  let home = '';
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'ready-'));
    mkdirSync(join(home, '.claude'), { recursive: true });
    mkdirSync(join(home, '.config', 'anthropic'), { recursive: true });
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
  });

  const writeCreds = (o: unknown) => writeFileSync(join(home, '.claude', '.credentials.json'), JSON.stringify(o));
  const oauth = (extra: Record<string, unknown> = {}) => ({ claudeAiOauth: { accessToken: 'tok', refreshToken: 'ref', expiresAt: Date.now() + 60_000, ...extra } });

  it('reconhece o login OAuth do CLI', () => {
    writeCreds(oauth());
    expect(claudeReady(home)).toBe(true);
  });

  it('não vê login em box sem credencial nenhuma', () => {
    expect(claudeReady(home)).toBe(false);
  });

  it('recusa credencial de 0 byte', () => {
    writeFileSync(join(home, '.config', 'anthropic', 'credentials'), '');
    expect(claudeReady(home)).toBe(false);
  });

  // O caso que passava batido: quem configurou um MCP server tem o arquivo cheio de
  // tokens de OAuth de MCP sem nunca ter logado na conta Claude.
  it('recusa credentials.json que só tem OAuth de MCP', () => {
    writeCreds({ mcpOAuth: { 'miro|abc': { accessToken: 'x' } } });
    expect(claudeReady(home)).toBe(false);
  });

  it('recusa credentials.json corrompido', () => {
    writeFileSync(join(home, '.claude', '.credentials.json'), '{ nao e json');
    expect(claudeReady(home)).toBe(false);
  });

  it('recusa accessToken vazio', () => {
    writeCreds(oauth({ accessToken: '' }));
    expect(claudeReady(home)).toBe(false);
  });

  // Vencido AINDA é login: o CLI renova sozinho com o refreshToken.
  it('aceita token vencido que tem refreshToken', () => {
    writeCreds(oauth({ expiresAt: Date.now() - 60_000 }));
    expect(claudeReady(home)).toBe(true);
  });

  it('recusa token vencido sem refreshToken', () => {
    writeCreds({ claudeAiOauth: { accessToken: 'tok', expiresAt: Date.now() - 60_000 } });
    expect(claudeReady(home)).toBe(false);
  });

  it('a key no env dispensa arquivo de credencial', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-x');
    expect(claudeReady(home)).toBe(true);
  });

  // Env setada como string em branco é sobra de `export ANTHROPIC_API_KEY=` num
  // .bashrc — dizia "pronto" e o spawn morria com 401.
  it('recusa key em branco no env', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '   ');
    expect(claudeReady(home)).toBe(false);
  });
});
