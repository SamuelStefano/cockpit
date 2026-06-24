import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { ContextMeta } from '../shared/protocol';
import { CONFIG } from './config';
import { parseFrontmatter, stripFrontmatter } from './frontmatter';

export { parseFrontmatter, unquote, stripFrontmatter } from './frontmatter';

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

// Slug seguro pra anexo IMPORTADO: prefixo `imported-` (nunca colide/sobrescreve um
// arquivo do próprio agente) + saneamento ao SLUG_RE.
export const MAX_IMPORT_BYTES = 512 * 1024;
export function importSlug(slug: string): string {
  const base = String(slug || 'shared').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'shared';
  return `imported-${base}`;
}

// ESCRITA (compartilhamento): grava um contexto importado no memoryDir da própria
// conta. PRIMEIRO write path do surfacing — por isso os guards são rígidos: slug
// allow-listado + prefixo imported- + anti-traversal + cap de tamanho. Vira um .md
// normal lido pelo fluxo READ-ONLY depois.
export async function installContext(slug: string, title: string, body: string): Promise<{ id: string } | { error: string }> {
  if (typeof body !== 'string' || !body.trim()) return { error: 'conteúdo vazio' };
  if (Buffer.byteLength(body) > MAX_IMPORT_BYTES) return { error: 'conteúdo grande demais' };
  const id = importSlug(slug);
  if (!SLUG_RE.test(id)) return { error: 'slug inválido' };
  const dir = resolve(CONFIG.memoryDir);
  const full = resolve(join(dir, `${id}.md`));
  if (!full.startsWith(dir + '/') || basename(full) !== `${id}.md`) return { error: 'caminho inválido' };
  const safeTitle = String(title || id).replace(/[\r\n]/g, ' ').slice(0, 120);
  const fm = `---\nname: ${safeTitle}\ndescription: importado via compartilhamento\nmetadata:\n  type: reference\n---\n\n`;
  try { await mkdir(dir, { recursive: true }); await writeFile(full, fm + body, 'utf8'); }
  catch { return { error: 'falha ao gravar' }; }
  return { id };
}

