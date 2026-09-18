import { describe, it, expect } from 'vitest';
import { adaptPack, adaptSkill, validRef } from './skill-registry';

describe('validRef', () => {
  it('accepts owner/repo plus a slug', () => {
    expect(validRef({ source: 'devfellowship/internal-skills', slug: 'brand-voice' })).toBe(true);
  });
  it('rejects anything that could reshape the request path', () => {
    expect(validRef({ source: 'devfellowship', slug: 'x' })).toBe(false);
    expect(validRef({ source: 'a/b/c', slug: 'x' })).toBe(false);
    expect(validRef({ source: 'a/b', slug: '../x' })).toBe(false);
    expect(validRef({ source: 'a/b', slug: 'x?y=1' })).toBe(false);
  });
});

describe('adaptSkill', () => {
  it('maps the registry row and drops a blank author', () => {
    const s = adaptSkill({ source: 'o/r', skill: 'x', name: 'X', description: 'd', author: '', tags: ['a', 1], visibility: 'internal' });
    expect(s).toEqual({ source: 'o/r', slug: 'x', name: 'X', description: 'd', author: null, tags: ['a'], categories: [], visibility: 'internal' });
  });
});

describe('adaptPack', () => {
  it('orders members by manifest ordinal and coerces an unknown role to suggested', () => {
    const p = adaptPack({
      source: 'o/r', pack: 'p', name: 'P', root: 'a',
      members: [
        { slug: 'b', role: 'required', ordinal: 1, status: 'in_catalogue' },
        { slug: 'a', role: 'root', ordinal: 0, status: 'in_catalogue' },
        { slug: 'c', role: 'weird', ordinal: 2, status: 'not_published' },
      ],
    });
    expect(p.members.map((m) => [m.slug, m.role, m.published, m.source])).toEqual([
      ['a', 'root', true, 'o/r'], ['b', 'required', true, 'o/r'], ['c', 'suggested', false, 'o/r'],
    ]);
  });
});
