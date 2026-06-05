import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { SkillMeta } from '../shared/protocol';
import { CONFIG } from './config';

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

interface Fm { name?: string; description?: string }

function parseFrontmatter(text: string): Fm {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  const block = end >= 0 ? text.slice(3, end) : text.slice(3);
  const fm: Fm = {};
  for (const line of block.split('\n')) {
    const m = /^\s*([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, valRaw] = m;
    const val = unquote(valRaw.trim());
    if (key === 'name' && !fm.name) fm.name = val;
    else if (key === 'description' && !fm.description) fm.description = val;
  }
  return fm;
}

function unquote(s: string): string {
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
  return s;
}
