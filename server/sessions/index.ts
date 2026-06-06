import { readdir, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionMeta } from '../../shared/protocol';
import { CONFIG } from '../config';
import { hiddenSet } from '../store';

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

export interface MetaScan { title: string; firstUser?: string; count: number; consumed: number }

// Cache em memória invalidado por mtime. Guarda `size` + o `scan` cru pra permitir
// scan incremental: JSONL de sessão é append-only, então quando o arquivo só cresce
// relê apenas a cauda nova (de `consumed`) em vez do arquivo inteiro a cada `list`.
const cache = new Map<string, { mtime: number; size: number; scan: MetaScan; meta: SessionMeta }>();

export function listSessions(): Promise<SessionMeta[]> {
  return collectMetas((id, hidden) => !hidden.has(id));
}

// Só as arquivadas (escondidas do sidebar principal).
export function listArchived(): Promise<SessionMeta[]> {
  return collectMetas((id, hidden) => hidden.has(id));
}

async function collectMetas(keep: (id: string, hidden: Set<string>) => boolean): Promise<SessionMeta[]> {
  let files: string[];
  try {
    files = await readdir(CONFIG.projectsDir);
  } catch {
    return [];
  }

  // Poda entradas órfãs: ids no cache cujo .jsonl sumiu (sessão apagada fora do
  // app). Baseado no conjunto COMPLETO de arquivos — não no recorte de `keep` —
  // senão arquivadas (filtradas aqui) seriam despejadas a cada listSessions.
  const live = new Set<string>();
  for (const f of files) if (UUID_FILE.test(f)) live.add(f.replace('.jsonl', ''));
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);

  const hidden = await hiddenSet();
  const metas: SessionMeta[] = [];
  for (const f of files) {
    if (!UUID_FILE.test(f)) continue;
    const id = f.replace('.jsonl', '');
    if (!keep(id, hidden)) continue;
    const full = join(CONFIG.projectsDir, f);
    let st;
    try { st = await stat(full); } catch { continue; }
    const mtime = st.mtimeMs;

    const hit = cache.get(id);
    if (hit && hit.mtime === mtime) { metas.push(hit.meta); continue; }

    const prev = hit && st.size > hit.size ? hit.scan : undefined;
    const scan = await scanMeta(full, prev);
    const meta = metaFromHead(id, mtime, scan);
    cache.set(id, { mtime, size: st.size, scan, meta });
    metas.push(meta);
  }

  return metas.sort((a, b) => b.mtime - a.mtime);
}

// Constrói (ou reusa do cache) a SessionMeta de um id — usado pela busca pra
// decorar arquivos casados sem re-listar tudo.
export async function metaForId(id: string): Promise<SessionMeta | null> {
  if (!UUID_FILE.test(`${id}.jsonl`)) return null;
  const full = join(CONFIG.projectsDir, `${id}.jsonl`);
  let st;
  try { st = await stat(full); } catch { return null; }
  const mtime = st.mtimeMs;
  const hit = cache.get(id);
  if (hit && hit.mtime === mtime) return hit.meta;
  const prev = hit && st.size > hit.size ? hit.scan : undefined;
  const scan = await scanMeta(full, prev);
  const meta = metaFromHead(id, mtime, scan);
  cache.set(id, { mtime, size: st.size, scan, meta });
  return meta;
}

// Monta a SessionMeta a partir do cabeçalho escaneado — compartilhado pela
// listagem e pela decoração de busca, pra os dois não divergirem nos defaults.
export function metaFromHead(id: string, mtime: number, head: { title: string; firstUser?: string; count: number }, now = Date.now()): SessionMeta {
  return {
    id,
    title: head.title || head.firstUser?.slice(0, 60) || 'Sem título',
    relative: relTime(mtime, now),
    snippet: head.firstUser?.slice(0, 120) || '',
    mtime,
    count: head.count,
  };
}

// Funde linhas COMPLETAS de JSONL no acumulador: ÚLTIMO ai-title, 1ª msg de user,
// contagem, e bytes consumidos (offset da última `\n`, pra retomada incremental).
// Pura e combinável — `prev` continua um scan anterior sobre a cauda nova.
export function scanMetaText(text: string, prev?: MetaScan): MetaScan {
  let title = prev?.title ?? '';
  let firstUser = prev?.firstUser;
  let count = prev?.count ?? 0;
  let consumed = prev?.consumed ?? 0;
  let i = 0;
  let nl: number;
  while ((nl = text.indexOf('\n', i)) >= 0) {
    const raw = text.slice(i, nl);
    consumed += Buffer.byteLength(raw, 'utf8') + 1;
    i = nl + 1;
    const line = raw.trim();
    if (!line) continue;
    let o: any;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'ai-title' && o.aiTitle) title = o.aiTitle;
    else if (o.type === 'user' || o.type === 'assistant') {
      count++;
      if (!firstUser && o.type === 'user' && o.message) {
        const c = o.message.content;
        firstUser = typeof c === 'string'
          ? c
          : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join(' ') : '';
      }
    }
  }
  return { title, firstUser, count, consumed };
}

// Lê do byte `prev.consumed` até EOF (full scan quando prev ausente) e funde com
// scanMetaText. JSONL é append-only: relê só a cauda quando o arquivo cresceu.
async function scanMeta(path: string, prev?: MetaScan): Promise<MetaScan> {
  const fh = await open(path, 'r');
  try {
    const stream = fh.createReadStream({ encoding: 'utf8', start: prev?.consumed ?? 0 });
    let acc: MetaScan = prev ?? { title: '', count: 0, consumed: 0 };
    let buf = '';
    for await (const chunk of stream) {
      buf += chunk;
      const lastNl = buf.lastIndexOf('\n');
      if (lastNl >= 0) {
        acc = scanMetaText(buf.slice(0, lastNl + 1), acc);
        buf = buf.slice(lastNl + 1);
      }
    }
    return acc;
  } finally {
    await fh.close();
  }
}

export function relTime(ms: number, now = Date.now()): string {
  const diff = now - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ontem' : `${d}d atrás`;
}
