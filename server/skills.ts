import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { SkillMeta } from '../shared/protocol';
import { CONFIG } from './config';
import { parseFrontmatter } from './frontmatter';
import { importSlug, MAX_IMPORT_BYTES } from './contexts';

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

// Regras de permissão p/ NEGAR as skills não-selecionadas no `claude -p` (não há
// flag nativa de "use só estas"; o caminho confiável é --disallowedTools). Recebe
// os ids SELECIONADOS pela UI e a lista completa; devolve `Skill(...)` pra cada
// skill de FORA da seleção. Seleção vazia = []: nada negado = todas ativas (default).
// Puro/testável (lista injetada). As regras entram num arg space-joined, então só
// emite identificadores sem espaço (id é slug; name idem quando bate o SLUG_RE).
export function skillDenyRules(selected: string[] | undefined, all: SkillMeta[]): string[] {
  if (!selected || selected.length === 0) return [];
  const keep = new Set(selected);
  const rules = new Set<string>();
  for (const s of all) {
    if (keep.has(s.id)) continue;
    if (SLUG_RE.test(s.id)) rules.add(`Skill(${s.id})`);
    if (s.name && s.name !== s.id && SLUG_RE.test(s.name)) rules.add(`Skill(${s.name})`);
  }
  return [...rules];
}

// Resolve as regras de negação lendo a lista de skills do disco. Conveniência
// async pro dispatch; a lógica pura vive em skillDenyRules.
export async function resolveSkillDeny(selected: string[] | undefined): Promise<string[]> {
  if (!selected || selected.length === 0) return [];
  return skillDenyRules(selected, await listSkills());
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

// ESCRITA (compartilhamento): grava uma skill importada como imported-<slug>/SKILL.md
// na própria conta. Mesmos guards do contexto (slug allow-listado + prefixo imported-
// + anti-traversal + cap). body é o SKILL.md inteiro (com frontmatter).
export async function installSkill(slug: string, _name: string, body: string): Promise<{ id: string } | { error: string }> {
  if (typeof body !== 'string' || !body.trim()) return { error: 'conteúdo vazio' };
  if (Buffer.byteLength(body) > MAX_IMPORT_BYTES) return { error: 'conteúdo grande demais' };
  const id = importSlug(slug);
  if (!SLUG_RE.test(id)) return { error: 'slug inválido' };
  const dir = resolve(CONFIG.skillsDir);
  const sdir = resolve(join(dir, id));
  const full = resolve(join(sdir, 'SKILL.md'));
  if (!sdir.startsWith(dir + '/') || !full.startsWith(sdir + '/') || basename(full) !== 'SKILL.md') return { error: 'caminho inválido' };
  try { await mkdir(sdir, { recursive: true }); await writeFile(full, body, 'utf8'); }
  catch { return { error: 'falha ao gravar' }; }
  return { id };
}

