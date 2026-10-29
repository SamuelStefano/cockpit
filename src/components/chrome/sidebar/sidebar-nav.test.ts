import { describe, it, expect } from 'vitest';
import { sidebarNav, canOpenSettings } from './sidebar-nav';

describe('sidebarNav', () => {
  it('lays out every work surface for root; Pontos and Graph are off the nav', () => {
    expect(sidebarNav('root').map((i) => i.label)).toEqual(['Canvas', 'Skills', 'Conexões', 'Docs', 'Rotinas', 'Memória']);
  });

  it('gives admin the same list', () => {
    expect(sidebarNav('admin').map((i) => i.label)).toEqual(['Canvas', 'Skills', 'Conexões', 'Docs', 'Rotinas', 'Memória']);
  });

  it('keeps a student off every side route: navFor still gates every entry', () => {
    expect(sidebarNav('student').map((i) => i.label)).toEqual([]);
    expect(canOpenSettings('student')).toBe(true);
  });
});
