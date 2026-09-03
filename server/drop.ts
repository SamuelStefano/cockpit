import { chmod, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { DropRef } from '../shared/protocol';

// Drop privado: entrega um segredo/script à box do agente SEM que o conteúdo ecoe
// em lugar nenhum. As três vias existentes vazam por construção — o chat grava o
// texto no JSONL e o reenvia ao modelo a cada turno/compactação; o anexo
// (attachments.ts) espelha no S3 compartilhado E injeta o texto no prompt; a nota
// vira prompt no "Analisar com IA". Aqui o conteúdo só toca o disco local: NÃO
// passa pelo pipeline de anexo, NÃO sobe pro S3 e nenhuma resposta do protocolo
// devolve o texto, exceto o drop-open explícito.
// Limite honesto: o conteúdo ainda cruza o WebSocket (no relay T3 a DFL opera o
// caminho — ver ARCHITECTURE.md "trusted-relay beta") e, se o agente der Read no
// arquivo, o texto entra no contexto e volta pro JSONL. O ganho é tirar o segredo
// do transcript por padrão, não criptografia ponta-a-ponta.

// Slug = nome de arquivo, não caminho: sem barra, sem '..' e sem ponto inicial
// (dotfile esconderia o drop da listagem e colidiria com o índice de TTL).
const SLUG_RE = /^[a-zA-Z0-9._-]{1,64}$/;

// Índice de expiração. Fica DENTRO do dir (um arquivo só, 0600) e é inalcançável
// pela API porque começa com ponto — nenhum slug válido resolve pra ele.
const INDEX = '.ttl.json';

const MAX_BYTES = 1_000_000;
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const DIR_MODE = 0o700;
const FILE_MODE = 0o600;

// Caminho lido em runtime (não no load) pra ser testável via COCKPIT_DROP_DIR,
// mesmo padrão dos outros caminhos de estado (ver .env.example).
function dropDir(): string {
  return process.env.COCKPIT_DROP_DIR ?? join(homedir(), '.deck-drop');
}

export function validSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_RE.test(slug) && !slug.startsWith('.');
}

// Prova que o caminho final está DENTRO do dir: o slug chega cru do WS e a regex
// sozinha não é a garantia — quem garante é a comparação do resolve().
function pathFor(slug: string): string | null {
  if (!validSlug(slug)) return null;
  const root = resolve(dropDir());
  const full = resolve(root, slug);
  return full.startsWith(root + sep) ? full : null;
}

async function ensureDir(): Promise<string> {
  const root = resolve(dropDir());
  await mkdir(root, { recursive: true, mode: DIR_MODE });
  // mkdir só aplica o mode na CRIAÇÃO e ainda passa pelo umask; um dir que já
  // existia com 0755 continuaria legível por outra conta da box.
  await chmod(root, DIR_MODE);
  return root;
}

async function readIndex(): Promise<Record<string, number>> {
  try {
    const raw = JSON.parse(await readFile(join(resolve(dropDir()), INDEX), 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (validSlug(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

async function writeIndex(idx: Record<string, number>): Promise<void> {
  const file = join(await ensureDir(), INDEX);
  await writeFile(file, JSON.stringify(idx), { mode: FILE_MODE });
  await chmod(file, FILE_MODE);
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function refFor(slug: string, full: string, expiresAt?: number): Promise<DropRef | null> {
  try {
    const st = await stat(full);
    if (!st.isFile()) return null;
    const buf = await readFile(full);
    return { slug, path: full, bytes: st.size, sha256: sha256(buf), mtime: st.mtimeMs, expiresAt };
  } catch {
    return null;
  }
}

// Grava o drop e devolve SÓ a referência — nunca o conteúdo. Quem quiser o texto
// pede drop-open de propósito.
export async function putDrop(slug: string, content: unknown, ttlMs?: unknown): Promise<DropRef | { error: string }> {
  const full = pathFor(slug);
  if (!full) return { error: 'nome inválido' };
  if (typeof content !== 'string' || content.length === 0) return { error: 'conteúdo vazio' };
  const buf = Buffer.from(content, 'utf8');
  if (buf.length > MAX_BYTES) return { error: 'conteúdo grande demais' };

  await ensureDir();
  await writeFile(full, buf, { mode: FILE_MODE });
  // Idem ensureDir: sobrescrever um arquivo pré-existente preserva o modo antigo.
  await chmod(full, FILE_MODE);

  const ttl = typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0 ? Math.min(ttlMs, MAX_TTL_MS) : 0;
  const idx = await readIndex();
  if (ttl) idx[slug] = Date.now() + ttl;
  else delete idx[slug];
  await writeIndex(idx);

  const ref = await refFor(slug, full, ttl ? idx[slug] : undefined);
  return ref ?? { error: 'não deu pra gravar o drop' };
}

// Lista as referências (sem conteúdo). Drop vencido é tratado como inexistente e
// apagado na hora: a varredura periódica é grossa demais pra um TTL de minutos.
export async function listDrops(now = Date.now()): Promise<DropRef[]> {
  const root = resolve(dropDir());
  let names: string[];
  try { names = await readdir(root); } catch { return []; }
  const idx = await readIndex();
  const out: DropRef[] = [];
  for (const name of names) {
    if (!validSlug(name)) continue;
    const full = pathFor(name);
    if (!full) continue;
    const expiresAt = idx[name];
    if (expiresAt && expiresAt <= now) { await rm(full, { force: true }).catch(() => {}); continue; }
    const ref = await refFor(name, full, expiresAt);
    if (ref) out.push(ref);
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Último recurso: devolve o conteúdo. Só quando não há caminho de consumo sem
// imprimir (env.json, import no Infisical, script que executa o arquivo).
export async function openDrop(slug: string, now = Date.now()): Promise<{ ref: DropRef; content: string } | { error: string }> {
  const full = pathFor(slug);
  if (!full) return { error: 'nome inválido' };
  const idx = await readIndex();
  const expiresAt = idx[slug];
  if (expiresAt && expiresAt <= now) { await rm(full, { force: true }).catch(() => {}); return { error: 'drop expirado' }; }
  const ref = await refFor(slug, full, expiresAt);
  if (!ref) return { error: 'drop não encontrado' };
  return { ref, content: await readFile(full, 'utf8') };
}

export async function removeDrop(slug: string): Promise<{ ok: true } | { error: string }> {
  const full = pathFor(slug);
  if (!full) return { error: 'nome inválido' };
  await rm(full, { force: true });
  const idx = await readIndex();
  if (slug in idx) { delete idx[slug]; await writeIndex(idx); }
  return { ok: true };
}

// Varredura dos expirados (boot + periódica, junto do sweepMcpConfigs). Também
// poda o índice de slug que já não tem arquivo, senão ele cresce sem teto.
export async function sweepDrops(now = Date.now()): Promise<number> {
  const root = resolve(dropDir());
  const idx = await readIndex();
  let removed = 0;
  let changed = false;
  for (const [slug, expiresAt] of Object.entries(idx)) {
    const full = pathFor(slug);
    if (!full || !full.startsWith(root + sep)) { delete idx[slug]; changed = true; continue; }
    if (expiresAt <= now) {
      try { await rm(full, { force: true }); removed++; } catch { /* corrida com outra remoção */ }
      delete idx[slug];
      changed = true;
      continue;
    }
    try { await stat(full); } catch { delete idx[slug]; changed = true; }
  }
  if (changed) await writeIndex(idx).catch(() => {});
  return removed;
}
