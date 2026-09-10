import { mkdir, writeFile, access } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { FUNNEL_INSTR } from '../shared/funnel-prompt';
import { CONFIG } from './config';
import { parseSession } from './sessions/parse';
import { metaForId } from './sessions/index';
import { transcriptText } from './summary';
import { brtDay, distillPrompt, headTail } from './handoff';
import { hideSession } from './store';

// Afunilamento: o handoff (server/handoff.ts) resolve UMA sessão lotada; aqui o
// problema é o oposto — dezenas de sessões PARADAS que ninguém vai reabrir e que
// custam rolagem e busca. Uma única destilação lê todas e grava UM contexto, e só
// depois as sessões são arquivadas.

const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const UUID_RE = /^[0-9a-fA-F-]{8,64}$/;
export const MAX_SESSIONS = 20;  // teto de custo: ~1 destilação de ~15k tokens de input
const TOTAL_CAP = 60_000;        // chars de transcrição somados, divididos entre as sessões
const MIN_SHARE = 1_500;
const MAX_BODY_CHARS = 40_000;

let running = false;

export interface FunnelPart { title: string; transcript: string }

// Cada sessão leva uma fatia igual do orçamento, com piso: 20 sessões a 3k chars
// dizem mais sobre o conjunto do que 3 sessões inteiras e 17 truncadas em nada.
export function shareCap(count: number): number {
  return Math.max(MIN_SHARE, Math.floor(TOTAL_CAP / Math.max(1, count)));
}

export function buildFunnelPrompt(parts: FunnelPart[]): string {
  const body = parts.map((p) => `---\n# SESSÃO: ${p.title}\n${p.transcript}`).join('\n\n');
  return `${FUNNEL_INSTR}\n\n${body}`;
}

export function funnelSlug(at = new Date(), seq = 0): string {
  return seq > 1 ? `funil-${brtDay(at)}-${seq}` : `funil-${brtDay(at)}`;
}

export function funnelFile(slug: string, count: number, body: string, at = new Date()): string {
  const when = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(at);
  return `---\nname: ${slug}\ndescription: dossiê de ${count} sessões paradas arquivadas em ${when}\nmetadata:\n  type: reference\n---\n\n> Afunilamento de ${count} sessões paradas em ${when} (BRT). As sessões foram arquivadas; o histórico segue no disco.\n\n${body}\n`;
}

// Dois afunilamentos no mesmo dia não podem se sobrescrever: o 2º dossiê apagaria
// o 1º e as sessões dele já estariam arquivadas — perda silenciosa.
async function freeSlug(dir: string, at: Date): Promise<string | null> {
  for (let seq = 1; seq <= 20; seq++) {
    const slug = funnelSlug(at, seq);
    if (!SLUG_RE.test(slug)) return null;
    try { await access(join(dir, `${slug}.md`)); } catch { return slug; }
  }
  return null;
}

export interface FunnelResult { contextId?: string; archived: number; empty: number }

export async function funnelSessions(ids: string[], at = new Date()): Promise<FunnelResult | { error: string }> {
  // Uma destilação grande por vez: dois cliques em sequência gastariam a cota do
  // plano duas vezes pelo MESMO conjunto de sessões.
  if (running) return { error: 'já tem um afunilamento em andamento' };
  running = true;
  try {
    // Corta ANTES de validar: `sessionIds` vem de JSON cru e um array gigante não
    // pode virar um Set gigante só pra ser jogado fora no slice.
    const picked = [...new Set(ids.slice(0, MAX_SESSIONS * 10))]
      .filter((id) => typeof id === 'string' && UUID_RE.test(id))
      .slice(0, MAX_SESSIONS);
    if (!picked.length) return { error: 'nenhuma sessão elegível' };

    const cap = shareCap(picked.length);
    const parts: FunnelPart[] = [];
    let empty = 0;
    for (const id of picked) {
      const parsed = await parseSession(id).catch(() => null);
      const transcript = parsed ? headTail(transcriptText(parsed.messages, Infinity), cap) : '';
      if (!transcript) { empty++; continue; }
      const meta = await metaForId(id);
      parts.push({ title: meta?.title || id.slice(0, 8), transcript });
    }

    let contextId: string | undefined;
    if (parts.length) {
      let body: string | null;
      try { body = await distillPrompt(buildFunnelPrompt(parts), 4000); }
      catch { return { error: 'falha ao destilar o dossiê' }; }
      if (!body) return { error: 'não consegui destilar o dossiê' };
      body = body.slice(0, MAX_BODY_CHARS);

      const dir = resolve(CONFIG.memoryDir);
      const slug = await freeSlug(dir, at);
      if (!slug) return { error: 'não consegui nomear o contexto' };
      const full = resolve(join(dir, `${slug}.md`));
      if (!full.startsWith(dir + '/') || basename(full) !== `${slug}.md`) return { error: 'caminho inválido' };
      try {
        await mkdir(dir, { recursive: true });
        await writeFile(full, funnelFile(slug, parts.length, body, at), 'utf8');
      } catch { return { error: 'falha ao gravar o contexto' }; }
      contextId = slug;
    }

    // Arquivar é o ÚLTIMO passo, igual ao handoff: se a destilação falhar, o
    // usuário fica com as sessões intactas em vez de perder o fio delas.
    for (const id of picked) await hideSession(id);
    return { contextId, archived: picked.length, empty };
  } finally {
    running = false;
  }
}
