import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUNDLED_DIR, BUNDLED_MARKER, installBundledSkills, loadBundledSkills } from './bundled-skills';
import { listSkills } from './skills';
import { CONFIG } from './config';

let root: string;
let src: string;
let dest: string;

async function writeSrc(body: string, extra: Record<string, string> = {}) {
  await mkdir(join(src, 'guide', 'references'), { recursive: true });
  await writeFile(join(src, 'guide', 'SKILL.md'), body);
  for (const [p, c] of Object.entries(extra)) await writeFile(join(src, 'guide', p), c);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'bundled-'));
  src = join(root, 'src');
  dest = join(root, 'skills');
  await mkdir(src, { recursive: true });
});
afterEach(() => rm(root, { recursive: true, force: true }));

describe('installBundledSkills', () => {
  it('installs a missing skill with its references and a marker', async () => {
    await writeSrc('---\nname: guide\n---\nv1', { 'references/a.md': 'ref' });
    const r = await installBundledSkills(dest, src);
    expect(r.installed).toEqual(['guide']);
    expect(await readFile(join(dest, 'guide', 'SKILL.md'), 'utf8')).toContain('v1');
    expect(await readFile(join(dest, 'guide', 'references', 'a.md'), 'utf8')).toBe('ref');
    expect(await readdir(join(dest, 'guide'))).toContain(BUNDLED_MARKER);
  });

  it('is a no-op when nothing changed', async () => {
    await writeSrc('v1');
    await installBundledSkills(dest, src);
    expect(await installBundledSkills(dest, src)).toEqual({ installed: [], updated: [], kept: [] });
  });

  it('updates an untouched copy when the shipped version changes', async () => {
    await writeSrc('v1');
    await installBundledSkills(dest, src);
    await writeSrc('v2');
    const r = await installBundledSkills(dest, src);
    expect(r.updated).toEqual(['guide']);
    expect(await readFile(join(dest, 'guide', 'SKILL.md'), 'utf8')).toBe('v2');
  });

  it('keeps a copy the user edited', async () => {
    await writeSrc('v1');
    await installBundledSkills(dest, src);
    await writeFile(join(dest, 'guide', 'SKILL.md'), 'mine');
    await writeSrc('v2');
    const r = await installBundledSkills(dest, src);
    expect(r.kept).toEqual(['guide']);
    expect(await readFile(join(dest, 'guide', 'SKILL.md'), 'utf8')).toBe('mine');
  });

  it('keeps a user folder that has the same name but no marker', async () => {
    await mkdir(join(dest, 'guide'), { recursive: true });
    await writeFile(join(dest, 'guide', 'SKILL.md'), 'theirs');
    await writeSrc('v1');
    const r = await installBundledSkills(dest, src);
    expect(r.kept).toEqual(['guide']);
    expect(await readFile(join(dest, 'guide', 'SKILL.md'), 'utf8')).toBe('theirs');
  });

  it('ignores source folders without SKILL.md or with bad slugs', async () => {
    await mkdir(join(src, 'empty'), { recursive: true });
    await writeFile(join(src, 'empty', 'notes.md'), 'x');
    await mkdir(join(src, 'bad slug'), { recursive: true });
    await writeFile(join(src, 'bad slug', 'SKILL.md'), 'x');
    expect(await loadBundledSkills(src)).toEqual([]);
  });

  it('leaves no staging dirs behind', async () => {
    await writeSrc('v1');
    await installBundledSkills(dest, src);
    expect((await readdir(dest)).filter((n) => n.startsWith('.installing-'))).toEqual([]);
  });

  it('returns an empty report when the bundle dir is missing', async () => {
    expect(await installBundledSkills(dest, join(root, 'nope'))).toEqual({ installed: [], updated: [], kept: [] });
  });
});

describe('shipped deck-guide', () => {
  it('is a valid skill with a name, description and existing references', async () => {
    const skills = await loadBundledSkills(BUNDLED_DIR);
    const guide = skills.find((s) => s.slug === 'deck-guide');
    expect(guide).toBeTruthy();
    const body = guide!.files.find((f) => f.path === 'SKILL.md')!.bytes.toString('utf8');
    expect(body).toMatch(/^---\nname: deck-guide\ndescription: .+\n---/);
    const paths = new Set(guide!.files.map((f) => f.path));
    for (const ref of body.match(/references\/[a-z-]+\.md/g) ?? []) expect(paths.has(ref)).toBe(true);
  });

  it('shows up in the skills listing once installed', async () => {
    await installBundledSkills(dest, BUNDLED_DIR);
    const prev = CONFIG.skillsDir;
    (CONFIG as { skillsDir: string }).skillsDir = dest;
    try {
      const ids = (await listSkills()).map((s) => s.id);
      expect(ids).toContain('deck-guide');
    } finally {
      (CONFIG as { skillsDir: string }).skillsDir = prev;
    }
  });
});
