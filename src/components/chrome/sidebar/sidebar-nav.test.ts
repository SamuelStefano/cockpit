import { describe, it, expect } from 'vitest';
import { footerNav, FOOTER_NAV } from './sidebar-nav';

describe('footerNav', () => {
  it('lays out Equipe, Skills, Conexões, Configurações in that order for admin and root', () => {
    for (const role of ['admin', 'root'] as const) {
      expect(footerNav(role).map((i) => i.label)).toEqual(['Equipe', 'Skills', 'Conexões', 'Configurações']);
    }
  });

  it('keeps a student on Equipe and Configurações: navFor still gates every entry', () => {
    expect(footerNav('student').map((i) => i.id)).toEqual(['equipe', 'configuracoes']);
  });

  it('gives every entry its own route so only one is active at a time', () => {
    expect(new Set(FOOTER_NAV.map((i) => i.to)).size).toBe(FOOTER_NAV.length);
  });
});
