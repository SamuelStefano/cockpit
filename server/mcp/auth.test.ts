import { describe, it, expect } from 'vitest';
import { bearerToken, isMcpPath, mcpAuthorized, mcpSecret } from './auth';

describe('bearerToken', () => {
  it('extracts the token from a Bearer header, case-insensitively', () => {
    expect(bearerToken('Bearer s3cr3t')).toBe('s3cr3t');
    expect(bearerToken('bearer s3cr3t')).toBe('s3cr3t');
    expect(bearerToken('  Bearer\ts3cr3t  ')).toBe('s3cr3t');
  });

  it('returns empty for anything that is not a Bearer token', () => {
    expect(bearerToken(undefined)).toBe('');
    expect(bearerToken('')).toBe('');
    expect(bearerToken('Bearer')).toBe('');
    expect(bearerToken('Basic s3cr3t')).toBe('');
    expect(bearerToken('s3cr3t')).toBe('');
  });
});

describe('mcpAuthorized', () => {
  // CRÍTICO: esta rota é feita pra ser alcançada de fora da box. O gate do WS
  // libera quando não há token configurado (legado loopback-only); aqui isso
  // seria entregar o histórico do dono pra quem chegasse na porta.
  it('denies when the server has no token configured, even with a header', () => {
    expect(mcpAuthorized('', 'Bearer qualquer')).toBe(false);
    expect(mcpAuthorized('', undefined)).toBe(false);
  });

  it('accepts only the exact configured token', () => {
    expect(mcpAuthorized('s3cr3t', 'Bearer s3cr3t')).toBe(true);
    expect(mcpAuthorized('s3cr3t', 'Bearer errado')).toBe(false);
    expect(mcpAuthorized('s3cr3t', 'Bearer s3cr3')).toBe(false);
    expect(mcpAuthorized('s3cr3t', 'Bearer s3cr3tt')).toBe(false);
    expect(mcpAuthorized('s3cr3t', undefined)).toBe(false);
    expect(mcpAuthorized('s3cr3t', 's3cr3t')).toBe(false);
  });
});

describe('isMcpPath', () => {
  it('matches the exact path, with or without querystring', () => {
    expect(isMcpPath('/mcp')).toBe(true);
    expect(isMcpPath('/mcp?foo=1')).toBe(true);
  });

  it('does not match neighbouring paths', () => {
    expect(isMcpPath('/mcpx')).toBe(false);
    expect(isMcpPath('/mcp/extra')).toBe(false);
    expect(isMcpPath('/')).toBe(false);
    expect(isMcpPath(undefined)).toBe(false);
  });
});

// O token do WS destrava o app inteiro (terminal, spawn, send) e o do MCP vive em
// texto puro no mcp.json de outra máquina. Um token só fazia o vazamento daquele
// arquivo valer o Deck todo.
describe('mcpSecret', () => {
  it('prefere o token dedicado do MCP', () => {
    expect(mcpSecret('do-ws', 'do-mcp')).toBe('do-mcp');
  });

  it('cai no token do WS quando não há dedicado (compatibilidade)', () => {
    expect(mcpSecret('do-ws', '')).toBe('do-ws');
  });

  it('sem nenhum dos dois a rota continua fechada', () => {
    expect(mcpSecret('', '')).toBe('');
    expect(mcpAuthorized(mcpSecret('', ''), 'Bearer qualquer')).toBe(false);
  });

  // A recíproca não existe de propósito: quem tem o token do MCP não fala com o WS.
  it('o token do MCP não serve pro gate do WS', () => {
    expect(mcpAuthorized(mcpSecret('do-ws', 'do-mcp'), 'Bearer do-ws')).toBe(false);
  });
});
