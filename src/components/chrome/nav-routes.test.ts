import { describe, it, expect } from 'vitest';
import { navFor, roleRedirect } from './nav-routes';

describe('Skills, Conexões and Docs moved into Configurações', () => {
  it('are no longer standalone menu entries', () => {
    for (const role of ['root', 'admin', 'student'] as const) {
      const labels = navFor(role).map((n) => n.label);
      for (const gone of ['Skills', 'Conexões', 'Docs']) expect(labels).not.toContain(gone);
    }
  });

  it('keeps Configurações in every menu', () => {
    for (const role of ['root', 'admin', 'student'] as const) expect(navFor(role).some((n) => n.to === '/configuracoes')).toBe(true);
  });

  it('sends a student who opens the new URLs back to the home chat, never an admin', () => {
    for (const r of ['/configuracoes/conexoes', '/configuracoes/skills', '/configuracoes/docs'] as const) {
      expect(roleRedirect('student', r)).toBe('/');
      expect(roleRedirect('admin', r)).toBeNull();
      expect(roleRedirect('root', r)).toBeNull();
    }
    expect(roleRedirect('student', '/canvas')).toBe('/');
    expect(roleRedirect('student', '/canvas')).toBe('/');
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

describe('Loja (agent Store)', () => {
  it('is in the admin and root menus only, pointing at /agentes/loja', () => {
    for (const role of ['root', 'admin'] as const) expect(navFor(role).find((n) => n.label === 'Loja')?.to).toBe('/agentes/loja');
    expect(navFor('student').some((n) => n.to === '/agentes/loja')).toBe(false);
  });

  it('keeps a student off the Store URL', () => {
    expect(roleRedirect('student', '/agentes/loja')).toBe('/');
  });
});

describe('Explorar', () => {
  it('is in the admin and root menus, never the student one', () => {
    for (const role of ['root', 'admin'] as const) expect(navFor(role).find((n) => n.label === 'Explorar')?.to).toBe('/explorar');
    expect(navFor('student').some((n) => n.to === '/explorar')).toBe(false);
  });

  it('keeps a student off the URL and leaves it off the sidebar', async () => {
    expect(roleRedirect('student', '/explorar')).toBe('/');
    expect(roleRedirect('admin', '/explorar')).toBeNull();
    const { sidebarNav } = await import('./sidebar/sidebar-nav');
    expect(sidebarNav('root').some((n) => n.to === '/explorar')).toBe(false);
  });
});
