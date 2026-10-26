import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { adaptPack, adaptSkill, token, validRef } from './skill-registry';

describe('token', () => {
  afterEach(() => { delete process.env.DFL_MCP_DIR; });
  it('is null on a box with no DFL session, so the public tier still loads', async () => {
    process.env.DFL_MCP_DIR = await mkdtemp(join(tmpdir(), 'reg-'));
    expect(await token()).toBeNull();
  });
  it('is null when the credentials file has no access token', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reg-'));
    await writeFile(join(dir, 'credentials.json'), '{}');
    process.env.DFL_MCP_DIR = dir;
    expect(await token()).toBeNull();
  });
  it('returns the stored access token', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'reg-'));
    await writeFile(join(dir, 'credentials.json'), JSON.stringify({ access_token: 'abc' }));
    process.env.DFL_MCP_DIR = dir;
    expect(await token()).toBe('abc');
  });
});

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
