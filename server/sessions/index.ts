import { readdir, stat, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionMeta } from '../../shared/protocol';
import { relPast } from '../../shared/format';
import { CONFIG } from '../config';
import { hiddenSet, purgedSet, titleOverrides, noteOverrides } from '../store';
import { allSummaries, getSummary } from '../db';

const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

export interface MetaScan { title: string; firstUser?: string; count: number; consumed: number; lastTs?: number; asked?: boolean; endsQ?: boolean }

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
  const purged = await purgedSet();
  // Resumos vivem fora do JSONL (SQLite) e mudam sem o mtime do arquivo mover, então
  // aplica o resumo atual em CIMA do meta (cacheado ou fresco) a cada listagem.
  // Overrides manuais (titles/notes) idem — fora do JSONL, aplicados por id.
  const summaries = allSummaries();
  const titleOv = await titleOverrides();
  const noteOv = await noteOverrides();
  const metas: SessionMeta[] = [];
  for (const f of files) {
    if (!UUID_FILE.test(f)) continue;
    const id = f.replace('.jsonl', '');
    if (purged.has(id)) continue; // excluída: fora do sidebar E das arquivadas
    if (!keep(id, hidden)) continue;
    const full = join(CONFIG.projectsDir, f);
    let st;
    try { st = await stat(full); } catch { continue; }
    const mtime = st.mtimeMs;

    const hit = cache.get(id);
    let meta: SessionMeta;
    if (hit && hit.mtime === mtime) {
      meta = hit.meta;
    } else {
      const prev = hit && st.size > hit.size ? hit.scan : undefined;
      const scan = await scanMeta(full, prev);
      meta = metaFromHead(id, mtime, scan);
      cache.set(id, { mtime, size: st.size, scan, meta });
    }
    // Cópia rasa por listagem: o override NÃO é mutado no `meta` cacheado, senão
    // limpar o override depois não voltaria ao título derivado (ficaria grudado).
    // `relative` é recalculado do mtime (estável) a cada listagem — se viesse do
    // cache ficaria congelado no valor de quando a meta foi escaneada (ex: sessão
    // vista logo após o último turno grava "agora" e nunca envelhece pra "5min"/"1h",
    // já que o cache só invalida quando o mtime muda).
    metas.push({
      ...meta,
      relative: relPast(meta.mtime),
      title: titleOv[id] ?? meta.title,
      summary: noteOv[id] ?? summaries.get(id),
    });
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
  let meta: SessionMeta;
  if (hit && hit.mtime === mtime) {
    meta = hit.meta;
  } else {
    const prev = hit && st.size > hit.size ? hit.scan : undefined;
    const scan = await scanMeta(full, prev);
    meta = metaFromHead(id, mtime, scan);
    cache.set(id, { mtime, size: st.size, scan, meta });
  }
  const titleOv = await titleOverrides();
  const noteOv = await noteOverrides();
  return { ...meta, relative: relPast(meta.mtime), title: titleOv[id] ?? meta.title, summary: noteOv[id] ?? getSummary(id) ?? undefined };
}

// Monta a SessionMeta a partir do cabeçalho escaneado — compartilhado pela
// listagem e pela decoração de busca, pra os dois não divergirem nos defaults.
export function metaFromHead(id: string, mtime: number, head: { title: string; firstUser?: string; count: number; lastTs?: number; asked?: boolean; endsQ?: boolean }, now = Date.now()): SessionMeta {
  // Relógio de atividade = timestamp da ÚLTIMA mensagem do JSONL, não o mtime do
  // arquivo: resumir/abrir uma sessão toca o arquivo sem escrever mensagem, e aí
  // uma conversa de ontem aparecia como "30min atrás" e furava a ordem do sidebar.
  // mtime só entra como fallback (JSONL sem timestamp legível).
  const ts = head.lastTs ?? mtime;
  return {
    id,
    title: head.title || head.firstUser?.slice(0, 60) || 'Sem título',
    relative: relPast(ts, now),
    snippet: head.firstUser?.slice(0, 120) || '',
    mtime: ts,
    count: head.count,
    waiting: head.asked || head.endsQ || undefined,
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
  let lastTs = prev?.lastTs;
  let asked = prev?.asked ?? false;
  let endsQ = prev?.endsQ ?? false;
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
      const ts = typeof o.timestamp === 'string' ? Date.parse(o.timestamp) : NaN;
      if (!Number.isNaN(ts) && (lastTs === undefined || ts > lastTs)) lastTs = ts;
      if (!firstUser && o.type === 'user' && o.message) {
        const c = o.message.content;
        firstUser = typeof c === 'string'
          ? c
          : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join(' ') : '';
      }
      // Linha de subagente (isSidechain) nunca fala com o usuário: pergunta de
      // sidechain é respondida pelo agente-pai, não vira "aguardando você".
      if (o.isSidechain !== true) {
        if (o.type === 'user') {
          if (isUserPrompt(o)) { asked = false; endsQ = false; }
        } else {
          for (const b of assistantBlocks(o)) {
            if (b?.type === 'tool_use' && b.name === 'AskUserQuestion') asked = true;
            else if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) endsQ = endsWithQuestion(b.text);
          }
        }
      }
    }
  }
  return { title, firstUser, count, consumed, lastTs, asked, endsQ };
}

// Prompt DE VERDADE do usuário — o que zera o "aguardando você". Exclui
// tool_result (o CLI grava resultado de ferramenta como linha `user`) e linha
// meta/injetada (system-reminder, caveat): nenhum dos dois é resposta humana.
function isUserPrompt(o: any): boolean {
  if (o.isMeta === true || o.toolUseResult !== undefined) return false;
  const c = o.message?.content;
  if (typeof c === 'string') return c.trim().length > 0;
  if (!Array.isArray(c)) return false;
  return c.some((b: any) => b?.type === 'text' && typeof b.text === 'string' && b.text.trim().length > 0);
}

function assistantBlocks(o: any): any[] {
  const c = o.message?.content;
  if (Array.isArray(c)) return c;
  return typeof c === 'string' ? [{ type: 'text', text: c }] : [];
}

// Fecho de turno em pergunta ("quer que eu faça X?"). Tolera pontuação de
// fechamento depois do `?` (aspas, parênteses, markdown) pra não perder o sinal.
function endsWithQuestion(text: string): boolean {
  return /\?["'”’`)\]}*_]*$/.test(text.trim());
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
