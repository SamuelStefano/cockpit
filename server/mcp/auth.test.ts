import { describe, it, expect } from 'vitest';
import { bearerToken, isMcpPath, mcpAuthorized } from './auth';

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
