import { describe, it, expect } from 'vitest';
import { sidebarNav, canOpenSettings } from './sidebar-nav';

describe('sidebarNav', () => {
  it('lays out every work surface for root; Pull requests and Pontos are root-only, Graph is off the nav', () => {
    expect(sidebarNav('root').map((i) => i.label)).toEqual(['Canvas', 'Pull requests', 'Pontos', 'Loja', 'Rotinas']);
  });

  it('gives admin the same list', () => {
    expect(sidebarNav('admin').map((i) => i.label)).toEqual(['Canvas', 'Loja', 'Rotinas']);
  });

  it('keeps a student off every side route: navFor still gates every entry', () => {
    expect(sidebarNav('student').map((i) => i.label)).toEqual([]);
    expect(canOpenSettings('student')).toBe(true);
  });
});
