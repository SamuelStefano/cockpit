import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { SkillMeta } from '../shared/protocol';
import { CONFIG } from './config';
import { parseFrontmatter } from './frontmatter';

// Surfacing READ-ONLY das skills do agente. Cada skill é um DIRETÓRIO em
// CONFIG.skillsDir contendo um SKILL.md (com frontmatter name/description). O
// cockpit apenas LÊ: nenhum caminho de escrita. O id é um slug allow-listado e o
// path é validado contra traversal, igual aos guards de sessão/contexto.

const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;

export async function listSkills(): Promise<SkillMeta[]> {
  let entries;
  try { entries = await readdir(CONFIG.skillsDir, { withFileTypes: true }); } catch { return []; }

  const metas: SkillMeta[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const id = e.name;
    if (!SLUG_RE.test(id)) continue;
    const md = join(CONFIG.skillsDir, id, 'SKILL.md');
    let st;
    try { st = await stat(md); } catch { continue; } // sem SKILL.md = não é skill
    let head = '';
    try { head = (await readFile(md, 'utf8')).slice(0, 2000); } catch { continue; }
    const fm = parseFrontmatter(head);
    metas.push({
      id,
      name: fm.name || id.replace(/[-_]/g, ' '),
      description: fm.description || '',
      mtime: st.mtimeMs,
    });
  }
  return metas.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readSkill(id: string): Promise<{ name: string; body: string } | null> {
  if (!SLUG_RE.test(id)) return null;
  const dir = resolve(CONFIG.skillsDir);
  const full = resolve(join(dir, id, 'SKILL.md'));
  if (!full.startsWith(dir + '/') || basename(full) !== 'SKILL.md') return null; // anti-traversal
  let raw: string;
  try { raw = await readFile(full, 'utf8'); } catch { return null; }
  const fm = parseFrontmatter(raw.slice(0, 2000));
  return { name: fm.name || id.replace(/[-_]/g, ' '), body: raw };
}

