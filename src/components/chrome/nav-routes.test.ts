import { describe, it, expect } from 'vitest';
import { navFor, roleRedirect } from './nav-routes';

describe('/conexoes access', () => {
  it('is in the admin and root menus only', () => {
    expect(navFor('admin').some((n) => n.to === '/conexoes')).toBe(true);
    expect(navFor('root').some((n) => n.to === '/conexoes')).toBe(true);
    expect(navFor('student').some((n) => n.to === '/conexoes')).toBe(false);
  });

  it('sends a student who opens the URL back to the home chat', () => {
    expect(roleRedirect('student', '/conexoes')).toBe('/');
    expect(roleRedirect('student', '/sala')).toBe('/');
  });
});

describe('navLabel', () => {
  it('resolves exact and nested routes from the one table', async () => {
    const { navLabel } = await import('./nav-routes');
    expect(navLabel('/pontos')).toBe('Pontos');
    expect(navLabel('/equipe/memoria')).toBe('Memória');
    expect(navLabel('/configuracoes/uso')).toBe('Configurações');
  });
});
