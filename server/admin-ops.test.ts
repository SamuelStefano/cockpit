import { describe, it, expect } from 'vitest';
import { setEnv, addMcp, installCli, INSTALLABLE, validateMcpUrl } from './admin-ops';

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
