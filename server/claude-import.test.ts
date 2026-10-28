import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, symlink, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyClaudeImport, expandHome, isInside, scanClaudeImport, walkFiles } from './claude-import';

let root: string;
let target: string;
let src: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cimport-'));
  target = join(root, 'deck');
  const home = join(root, 'tainan');
  src = join(home, '.claude');
  await mkdir(join(target, '.claude'), { recursive: true });
  await mkdir(join(src, 'skills', 'alpha'), { recursive: true });
  await mkdir(join(src, 'skills', 'beta'), { recursive: true });
  await writeFile(join(src, 'skills', 'alpha', 'SKILL.md'), '# alpha');
  await writeFile(join(src, 'skills', 'alpha', '.env'), 'SECRET=1');
  await writeFile(join(src, 'skills', 'beta', 'SKILL.md'), '# beta');
  await mkdir(join(target, '.claude', 'skills', 'beta'), { recursive: true });
  await writeFile(join(src, 'CLAUDE.md'), 'memory');
  await mkdir(join(src, 'projects', 'p1', 'memory'), { recursive: true });
  await writeFile(join(src, 'projects', 'p1', 'memory', 'a.md'), 'fact');
  await mkdir(join(home, '.claude-mem'), { recursive: true });
  await writeFile(join(home, '.claude-mem', 'claude-mem.db'), 'sqlite');
  await writeFile(join(home, '.claude-mem', 'settings.json'), '{"key":"sk-1"}');
  await writeFile(join(home, '.claude.json'), JSON.stringify({ mcpServers: { gh: { command: 'npx', env: { GITHUB_TOKEN: 'ghp_x', LOG: 'info' } } } }));
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('scanClaudeImport', () => {
  it('previews skills, mcps and memory and flags what already exists', async () => {
    const s = await scanClaudeImport(src, target);
    expect(s.found).toBe(true);
    expect(s.skills).toEqual([{ name: 'alpha', exists: false }, { name: 'beta', exists: true }]);
    expect(s.mcps).toEqual([{ name: 'gh', exists: false, needsFill: ['GITHUB_TOKEN'] }]);
    expect(s.memory.map((m) => m.label)).toEqual(['CLAUDE.md', 'projects/*/memory', '.claude-mem']);
  });
  it('reports a missing and a relative path', async () => {
    expect((await scanClaudeImport(join(root, 'nope'), target)).reason).toBe('not-found');
    expect((await scanClaudeImport('relative/dir', target)).reason).toBe('invalid');
  });
  it('flags the Deck own ~/.claude as the same source', async () => {
    expect((await scanClaudeImport(undefined, target)).reason).toBe('same-as-target');
  });
});

describe('applyClaudeImport', () => {
  it('copies, skips existing names, drops secret files and secret env values', async () => {
    const r = await applyClaudeImport(src, ['skills', 'mcps', 'memory'], target);
    expect(r.copied.skills).toEqual(['alpha']);
    expect(r.skipped).toContain('skill beta');
    expect(await readdir(join(target, '.claude', 'skills', 'alpha'))).toEqual(['SKILL.md']);
    const cfg = JSON.parse(await readFile(join(target, '.claude.json'), 'utf8'));
    expect(cfg.mcpServers.gh.env).toEqual({ GITHUB_TOKEN: '', LOG: 'info' });
    expect(r.needsFill).toEqual([{ mcp: 'gh', keys: ['GITHUB_TOKEN'] }]);
    expect(await readFile(join(target, '.claude', 'projects', 'p1', 'memory', 'a.md'), 'utf8')).toBe('fact');
    expect(await readdir(join(target, '.claude-mem'))).toEqual(['claude-mem.db']);
    expect(await readFile(join(src, 'CLAUDE.md'), 'utf8')).toBe('memory');
  });
  it('never overwrites and only touches the requested kinds', async () => {
    await writeFile(join(target, '.claude', 'CLAUDE.md'), 'mine');
    const r = await applyClaudeImport(src, ['memory'], target);
    expect(await readFile(join(target, '.claude', 'CLAUDE.md'), 'utf8')).toBe('mine');
    expect(r.copied.skills).toEqual([]);
    await expect(readFile(join(target, '.claude.json'))).rejects.toThrow();
  });
  it('refuses to import from itself', async () => {
    const r = await applyClaudeImport(join(target, '.claude'), ['skills'], target);
    expect(r.errors).toHaveLength(1);
  });
});

describe('path safety', () => {
  it('isInside rejects .. and symlink escapes', async () => {
    await writeFile(join(root, 'outside.txt'), 'x');
    await symlink(join(root, 'outside.txt'), join(src, 'link.txt'));
    expect(await isInside(src, join(src, 'CLAUDE.md'))).toBe(true);
    expect(await isInside(src, join(src, '..', 'deck'))).toBe(false);
    expect(await isInside(src, join(src, 'link.txt'))).toBe(false);
  });
  it('does not follow symlinked files or directories out of the tree', async () => {
    const outside = join(root, 'secret-dir');
    await mkdir(outside);
    await writeFile(join(outside, 'leak.md'), 'leak');
    await symlink(outside, join(src, 'skills', 'alpha', 'dirlink'));
    await symlink(join(root, 'tainan', '.claude.json'), join(src, 'skills', 'alpha', 'filelink.md'));
    expect((await walkFiles(join(src, 'skills', 'alpha'))).map((f) => f.rel)).toEqual(['SKILL.md']);
    await applyClaudeImport(src, ['skills'], target);
    expect(await readdir(join(target, '.claude', 'skills', 'alpha'))).toEqual(['SKILL.md']);
  });
  it('skips a symlinked skill dir and a symlinked memory file', async () => {
    await symlink(join(root, 'secret-dir'), join(src, 'skills', 'gamma')).catch(() => {});
    await symlink(join(root, 'tainan', '.claude.json'), join(src, 'projects', 'p1', 'memory', 'sneaky.md'));
    const r = await applyClaudeImport(src, ['skills', 'memory'], target);
    expect(r.copied.skills).not.toContain('gamma');
    await expect(readFile(join(target, '.claude', 'projects', 'p1', 'memory', 'sneaky.md'))).rejects.toThrow();
  });
  it('expands ~ and $HOME', () => {
    expect(expandHome('~/x', '/h')).toBe('/h/x');
    expect(expandHome('$HOME/claude-import/.claude', '/h')).toBe('/h/claude-import/.claude');
  });
});
