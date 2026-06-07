import type { Session } from '../data/mock';
import type { SessionMeta } from '../../shared/protocol';

// Default: mesma origin (proxy do vite/reverse-proxy resolve o /ws → :7777). Um
// deploy do front separado do back (ex: Vercel servindo a SPA, backend atrás de
// Tailscale serve) seta VITE_WS_URL pra apontar pro host real do backend. Sem
// isso a SPA tenta wss://<host-do-front>/ws e não acha ninguém atendendo.
const ENV_WS = (import.meta.env.VITE_WS_URL ?? '').trim();
export const WS_URL = ENV_WS || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

let _mid = 0;
// Sufixo aleatório além do contador monotônico: blinda contra colisão de key do
// React mesmo se dois ids forem gerados no mesmo tick após um reload de módulo.
export const newId = (p: string) => `${p}${Date.now().toString(36)}${(_mid++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function metaToSession(m: SessionMeta, active: boolean): Session {
  return { id: m.id, title: m.title, relative: m.relative, snippet: m.snippet, summary: m.summary, mtime: m.mtime, hasTerminal: false, active };
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
