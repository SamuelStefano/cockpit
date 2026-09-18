import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isSafeRelativePath, verifySkillFiles, writeSkillDir, type RegistryFile } from './skill-install';

const file = (path: string, content: string, over: Partial<RegistryFile> = {}): RegistryFile => ({
  path, content, encoding: 'utf-8', sha256: createHash('sha256').update(content).digest('hex'), ...over,
});

describe('isSafeRelativePath', () => {
  it('accepts nested relative paths', () => {
    expect(isSafeRelativePath('SKILL.md')).toBe(true);
    expect(isSafeRelativePath('references/brief-and-scenes.md')).toBe(true);
  });
  it('rejects traversal, absolute and odd paths', () => {
    for (const bad of ['../x', 'a/../../x', '/etc/passwd', 'a\\b', '', 'a//b', './a', 'a/./b', 'a b.md']) {
      expect(isSafeRelativePath(bad)).toBe(false);
    }
  });
});

describe('verifySkillFiles', () => {
  it('accepts files whose hash matches and that include SKILL.md', () => {
    const r = verifySkillFiles([file('SKILL.md', '# x'), file('references/a.md', 'a')]);
    expect(r.ok).toBe(true);
  });
  it('rejects a tampered file', () => {
    const r = verifySkillFiles([file('SKILL.md', '# x', { sha256: '0'.repeat(64) })]);
    expect(r).toEqual({ ok: false, error: 'hash não confere: SKILL.md' });
  });
  it('rejects a directory without SKILL.md, a traversal path and duplicates', () => {
    expect(verifySkillFiles([file('README.md', 'x')]).ok).toBe(false);
    expect(verifySkillFiles([file('SKILL.md', 'x'), file('../evil', 'x')]).ok).toBe(false);
    expect(verifySkillFiles([file('SKILL.md', 'x'), file('SKILL.md', 'x')]).ok).toBe(false);
  });
  it('decodes base64 content before hashing', () => {
    const raw = Buffer.from([0, 1, 2, 255]);
    const f: RegistryFile = { path: 'SKILL.md', encoding: 'base64', content: raw.toString('base64'), sha256: createHash('sha256').update(raw).digest('hex') };
    expect(verifySkillFiles([f]).ok).toBe(true);
  });
});

describe('writeSkillDir', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'skills-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('writes every file and leaves no staging dir behind', async () => {
    const v = verifySkillFiles([file('SKILL.md', '# hi'), file('references/a.md', 'a')]);
    if (!v.ok) throw new Error(v.error);
    expect(await writeSkillDir(dir, 'my-skill', v.files)).toEqual({ ok: true });
    expect(await readFile(join(dir, 'my-skill', 'references', 'a.md'), 'utf8')).toBe('a');
    expect(await readdir(dir)).toEqual(['my-skill']);
  });

  it('never overwrites an existing skill', async () => {
    await mkdir(join(dir, 'taken'));
    const v = verifySkillFiles([file('SKILL.md', '# hi')]);
    if (!v.ok) throw new Error(v.error);
    expect(await writeSkillDir(dir, 'taken', v.files)).toEqual({ ok: false, error: 'já instalada' });
  });

  it('refuses an invalid slug', async () => {
    expect(await writeSkillDir(dir, '../up', [])).toEqual({ ok: false, error: 'slug inválido' });
  });
});
