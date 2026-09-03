import { describe, it, expect } from 'vitest';
import { scanText, scanClientEnvNames } from './scan-secrets';

// Os literais abaixo são inventados e têm o formato certo de propósito — se a
// varredura não pegar isto aqui, ela não pega nada em produção.
describe('scanText', () => {
  it('pega token clássico do GitHub', () => {
    const f = scanText('dist/a.js', `const t="ghp_${'A'.repeat(36)}"`);
    expect(f[0]?.rule).toBe('github-pat');
  });

  it('pega chave privada', () => {
    expect(scanText('x', '-----BEGIN OPENSSH PRIVATE KEY-----')[0]?.rule).toBe('private-key');
  });

  it('pega JWT com papel service_role', () => {
    // "c2VydmljZV9yb2xl" é "service_role" em base64 — está em claro no payload.
    const jwt = `eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xl${'x'.repeat(8)}.sig`;
    expect(scanText('x', jwt)[0]?.rule).toBe('supabase-service-role');
  });

  it('não grita em código comum', () => {
    expect(scanText('x', 'const key = process.env.TOKEN; sk-not-a-key')).toEqual([]);
  });

  it('trunca o achado em vez de reimprimir o segredo inteiro no log', () => {
    const f = scanText('x', `ghp_${'B'.repeat(36)}`);
    expect(f[0].excerpt).toHaveLength(13);   // 12 caracteres + reticência
  });
});

describe('scanClientEnvNames', () => {
  it('pega segredo em variável embutida no bundle', () => {
    const f = scanClientEnvNames('src/a.ts', 'import.meta.env.VITE_GITHUB_TOKEN');
    expect(f[0]?.excerpt).toBe('VITE_GITHUB_TOKEN');
  });

  it('pega service_role exposto ao cliente', () => {
    expect(scanClientEnvNames('src/a.ts', 'NEXT_PUBLIC_SERVICE_ROLE_KEY')).toHaveLength(1);
  });

  it('deixa passar a anon key, que é pública por desenho', () => {
    expect(scanClientEnvNames('src/a.ts', 'import.meta.env.VITE_SUPABASE_ANON_KEY')).toEqual([]);
  });

  it('não confunde variável de servidor com variável de cliente', () => {
    expect(scanClientEnvNames('src/a.ts', 'process.env.GITHUB_TOKEN')).toEqual([]);
  });
});
