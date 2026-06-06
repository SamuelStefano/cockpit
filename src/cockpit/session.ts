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
  return { id: m.id, title: m.title, relative: m.relative, snippet: m.snippet, mtime: m.mtime, hasTerminal: false, active };
}
