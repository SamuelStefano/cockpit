import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { ContextMeta } from '../shared/protocol';
import { CONFIG } from './config';

// Surfacing READ-ONLY das memórias do agente (DR-005 D2a). Os .md vivem em
// CONFIG.memoryDir e são escritos só pelo agente — o cockpit apenas LÊ. Nenhum
// caminho de escrita aqui; o id é allow-listado a um slug e o path é validado
// contra traversal, igual aos guards de sessão.

const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;

export async function listContexts(): Promise<ContextMeta[]> {
  let files: string[];
  try { files = await readdir(CONFIG.memoryDir); } catch { return []; }

  const metas: ContextMeta[] = [];
  for (const f of files) {
    if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
    const id = f.slice(0, -3);
    if (!SLUG_RE.test(id)) continue;
    const full = join(CONFIG.memoryDir, f);
    let st;
    try { st = await stat(full); } catch { continue; }
    let head = '';
    try { head = (await readFile(full, 'utf8')).slice(0, 2000); } catch { continue; }
    const fm = parseFrontmatter(head);
    metas.push({
      id,
      title: fm.name || id.replace(/[-_]/g, ' '),
      description: fm.description || '',
      type: fm.type || 'memory',
      mtime: st.mtimeMs,
    });
  }
  return metas.sort((a, b) => b.mtime - a.mtime);
}

export async function readContext(id: string): Promise<{ title: string; body: string } | null> {
  if (!SLUG_RE.test(id)) return null;
  const dir = resolve(CONFIG.memoryDir);
  const full = resolve(join(dir, `${id}.md`));
  if (!full.startsWith(dir + '/') || basename(full) !== `${id}.md`) return null; // anti-traversal
  let raw: string;
  try { raw = await readFile(full, 'utf8'); } catch { return null; }
  const fm = parseFrontmatter(raw.slice(0, 2000));
  return { title: fm.name || id.replace(/[-_]/g, ' '), body: stripFrontmatter(raw) };
}

interface Fm { name?: string; description?: string; type?: string }

// Parser tolerante do frontmatter (name/description/type). description é uma
// linha física (longa, possivelmente entre aspas) nos arquivos atuais.
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
    else if (key === 'type' && !fm.type) fm.type = val;
  }
  return fm;
}

function unquote(s: string): string {
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
  return s;
}

function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw;
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return raw;
  const after = raw.indexOf('\n', end + 1);
  return after >= 0 ? raw.slice(after + 1).replace(/^\s+/, '') : '';
}
