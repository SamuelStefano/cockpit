import { describe, it, expect } from 'vitest';
import { sidebarNav, canOpenSettings } from './sidebar-nav';

describe('sidebarNav', () => {
  it('lays out every work surface for root, with Pontos', () => {
    expect(sidebarNav('root').map((i) => i.label)).toEqual(['Canvas', 'Pontos', 'Equipe', 'Skills', 'Conexões', 'Graph', 'Docs']);
  });

  it('hides root-only Pontos from admin', () => {
    expect(sidebarNav('admin').map((i) => i.label)).toEqual(['Canvas', 'Equipe', 'Skills', 'Conexões', 'Graph', 'Docs']);
  });

  it('keeps a student on Equipe: navFor still gates every entry', () => {
    expect(sidebarNav('student').map((i) => i.label)).toEqual(['Equipe']);
    expect(canOpenSettings('student')).toBe(true);
  });
});
