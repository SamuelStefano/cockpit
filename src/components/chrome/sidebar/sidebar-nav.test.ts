import { describe, it, expect } from 'vitest';
import { splitNav, NAV_ICONS } from './sidebar-nav';
import { NAV } from '../nav-routes';

describe('splitNav', () => {
  it('keeps chat, equipe and skills primary for admin and root', () => {
    expect(splitNav('admin').primary.map((n) => n.to)).toEqual(['/', '/equipe', '/skills']);
    expect(splitNav('root').primary.map((n) => n.to)).toEqual(['/', '/equipe', '/skills']);
  });

  it('gives a student only chat and equipe, with no "more" group', () => {
    const s = splitNav('student');
    expect(s.primary.map((n) => n.to)).toEqual(['/', '/equipe']);
    expect(s.more).toEqual([]);
  });

  it('hides root-only routes from admin and shows them to root', () => {
    expect(splitNav('admin').more.some((n) => n.to === '/pontos')).toBe(false);
    expect(splitNav('root').more.some((n) => n.to === '/pontos')).toBe(true);
  });

  it('puts every route of the role in exactly one group, each with an icon', () => {
    for (const role of ['root', 'admin', 'student'] as const) {
      const { primary, more } = splitNav(role);
      expect(primary.length + more.length).toBe(NAV.filter((n) => role === 'root' || (role === 'admin' ? !n.root : n.student)).length);
    }
    for (const n of NAV) expect(NAV_ICONS[n.to]).toBeTruthy();
  });
});
