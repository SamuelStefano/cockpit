import { describe, it, expect } from 'vitest';
import { sidebarNav, canOpenSettings } from './sidebar-nav';

describe('sidebarNav', () => {
  it('lays out every work surface for root; Pontos and Graph are off the nav', () => {
    expect(sidebarNav('root').map((i) => i.label)).toEqual(['Canvas', 'Equipe', 'Skills', 'Conexões', 'Docs']);
  });

  it('gives admin the same list', () => {
    expect(sidebarNav('admin').map((i) => i.label)).toEqual(['Canvas', 'Equipe', 'Skills', 'Conexões', 'Docs']);
  });

  it('keeps a student on Equipe: navFor still gates every entry', () => {
    expect(sidebarNav('student').map((i) => i.label)).toEqual(['Equipe']);
    expect(canOpenSettings('student')).toBe(true);
  });
});
