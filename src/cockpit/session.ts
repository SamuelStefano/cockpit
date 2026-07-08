import type { Session } from '../data/mock';
import type { SessionMeta } from '../../shared/protocol';
import { loadPref } from '../lib/persist';

// Default: mesma origin (proxy do vite/reverse-proxy resolve o /ws → :7777). Um
// deploy do front separado do back (ex: Vercel servindo a SPA, backend atrás de
// Tailscale serve) seta VITE_WS_URL pra apontar pro host real do backend. Sem
// isso a SPA tenta wss://<host-do-front>/ws e não acha ninguém atendendo.
const ENV_WS = (import.meta.env.VITE_WS_URL ?? '').trim();
export const WS_URL = ENV_WS || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

// Override por dispositivo (#147): um build único no Vercel não consegue setar
// VITE_WS_URL por aparelho. Salvar o endereço do backend no localStorage deixa o
// usuário apontar o celular/laptop pra sua VPS (Tailscale/público) sem rebuild.
// Precedência: override salvo > VITE_WS_URL do build > mesma origin. Lido a cada
// conexão (função, não const) pra valer logo após salvar.
export function wsBase(): string {
  const override = loadPref('ws.url', '').trim();
  return override || WS_URL;
}

// Monta a URL do WS a partir de uma base + token. Pura: a base entra pronta (de
// wsBase()), o token (DR-011 Fase 2) vai na query — browsers não mandam header no
// upgrade do WS. Sem token, conecta sem gate. Token errado → 4401 e a UI repergunta.
export function buildWsUrl(base: string, token: string): string {
  if (!token) return base;
  try {
    const u = new URL(base);
    u.searchParams.set('token', token);
    return u.toString();
  } catch {
    return base;
  }
}

export function wsUrlWithToken(token: string): string {
  return buildWsUrl(wsBase(), token);
}

// Base HTTP do relay (pra /pair/new etc.), derivada da URL do WS: ws→http, wss→
// https, e /ws no fim vira raiz. Mesma origem do relay, uma fonte só.
export function relayHttpBase(): string {
  const ws = wsBase();
  return ws.replace(/^ws/, 'http').replace(/\/ws$/, '');
}

let _mid = 0;
// Sufixo aleatório além do contador monotônico: blinda contra colisão de key do
// React mesmo se dois ids forem gerados no mesmo tick após um reload de módulo.
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(_mid++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function metaToSession(m: SessionMeta, active: boolean): Session {
  return { id: m.id, title: m.title, relative: m.relative, snippet: m.snippet, summary: m.summary, mtime: m.mtime, hasTerminal: false, active };
}

// Reconcilia o re-list do servidor com o estado local: preserva as sessões locais
// `new-` (ainda não persistidas) e faz MAX-MERGE do mtime — quando este re-list foi
// tirado o JSONL da mensagem recém-enviada pode não ter sido gravado, então o mtime
// do servidor vem ATRÁS do otimista. Sem preservar o maior, a sessão que o usuário
// acabou de mexer volta pro balde velho e "some" do topo até um F5 (group-by-recency
// ordena/agrupa só por mtime). Quando o otimista vence, mantém também o relative/
// snippet locais pra o card não mostrar um estado velho junto do mtime novo.
export function mergeServerSessions(prev: Session[], items: SessionMeta[], activeId: string): Session[] {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  const localOnly = prev.filter((s) => s.id.startsWith('new-'));
  const fromServer = items.map((m) => {
    const sess = metaToSession(m, m.id === activeId);
    const p = prevById.get(m.id);
    return p && p.mtime > sess.mtime ? { ...sess, mtime: p.mtime, relative: p.relative, snippet: p.snippet } : sess;
  });
  return [...localOnly, ...fromServer];
}

// Mantém a 1ª ocorrência de cada id, descartando duplicatas. Usado ao migrar a
// key local (new-…→uuid) quando o `list` do servidor já trouxe a mesma sessão.
export function dedupById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

// Reconcilia o mapa `seen` (id→mtime de baseline) contra a lista do servidor:
// ids novos entram com o mtime atual (não badgeiam retroativamente), ids `new-`
// locais são preservados, e ids sumidos (arquivados/apagados) são podados. Só
// mtime que AVANÇA depois é que marca a sessão como "atualizada". `changed`
// avisa o chamador se vale persistir/atualizar o estado.
export function mergeSeen(
  prev: Record<string, number>,
  items: { id: string; mtime: number }[],
): { next: Record<string, number>; changed: boolean } {
  const live = new Set(items.map((m) => m.id));
  const next: Record<string, number> = {};
  let changed = false;
  for (const m of items) {
    next[m.id] = prev[m.id] ?? m.mtime;
    if (prev[m.id] === undefined) changed = true;
  }
  for (const id of Object.keys(prev)) {
    if (id.startsWith('new-')) { next[id] = prev[id]; continue; }
    if (!live.has(id)) changed = true;
  }
  return { next, changed };
}
