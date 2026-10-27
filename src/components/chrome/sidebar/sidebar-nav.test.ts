import { describe, it, expect } from 'vitest';
import { splitNav, NAV_ICONS } from './sidebar-nav';
import { NAV } from '../nav-routes';

describe('splitNav', () => {
  it('keeps only skills primary for admin and root: chat and equipe are the sidebar itself', () => {
    expect(splitNav('admin').primary.map((n) => n.to)).toEqual(['/skills']);
    expect(splitNav('root').primary.map((n) => n.to)).toEqual(['/skills']);
    for (const role of ['root', 'admin', 'student'] as const) {
      const all = [...splitNav(role).primary, ...splitNav(role).more].map((n) => n.to);
      expect(all).not.toContain('/');
      expect(all).not.toContain('/equipe');
    }
  });

  it('gives a student no nav rows at all', () => {
    const s = splitNav('student');
    expect(s.primary).toEqual([]);
    expect(s.more).toEqual([]);
  });

  it('hides root-only routes from admin and shows them to root', () => {
    expect(splitNav('admin').more.some((n) => n.to === '/pontos')).toBe(false);
    expect(splitNav('root').more.some((n) => n.to === '/pontos')).toBe(true);
  });

  it('puts every other route of the role in exactly one group, each with an icon', () => {
    const inSidebar = (to: string) => to === '/' || to === '/equipe';
    for (const role of ['root', 'admin', 'student'] as const) {
      const { primary, more } = splitNav(role);
      expect(primary.length + more.length).toBe(NAV.filter((n) => !inSidebar(n.to) && (role === 'root' || (role === 'admin' ? !n.root : n.student))).length);
    }
    for (const n of NAV) expect(NAV_ICONS[n.to]).toBeTruthy();
  });
});
