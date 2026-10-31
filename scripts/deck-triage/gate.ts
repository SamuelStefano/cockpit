import type { Check } from './checks.ts';
import type { Incident } from './incidents.ts';

export const MULTI_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;
export const PERSIST_MS = 10 * 60 * 1000;
const ROUTINE_KINDS = new Set(['login-refused', 'unclean-exit']);

export type Verdict =
  | { verdict: 'confirmed'; reason: string; trusted?: string }
  | { verdict: 'user-side'; reason: string }
  | { verdict: 'suppress'; reason: string };

// A browser report alone proves nothing (a laptop on hotel wifi files one too). Only a
// failure seen from this VPS, several accounts at once, or one account stuck for 10 min
// earns a message.
// A trusted reporter (owner, partner) skips the wait: their report is escalated even
// with every synthetic check green.
export function decide(inc: Incident, synthFailing: Check[], all: Incident[], nowMs: number, trusted: ReadonlySet<string> = new Set()): Verdict {
  const t = inc.email && trusted.has(inc.email.toLowerCase()) ? inc.email : undefined;
  if (synthFailing.length) return { verdict: 'confirmed', reason: `checagem sintética falhando: ${synthFailing.map((c) => c.id).join(', ')}`, trusted: t };
  // With every check green these two are routine, not news: an expired login on a device and a planned restart.
  const routine = ROUTINE_KINDS.has(inc.kind) && inc.lastAt - inc.firstAt < PERSIST_MS;
  if (t && !routine) return { verdict: 'confirmed', reason: `reportado por ${t} (confiável)`, trusted: t };
  const accounts = new Set(all.filter((o) => o.kind === inc.kind && nowMs - o.lastAt <= MULTI_ACCOUNT_WINDOW_MS).map((o) => o.accountId));
  if (accounts.size >= 2) return { verdict: 'confirmed', reason: `${accounts.size} contas com ${inc.kind} em 10 min` };
  if (inc.lastAt - inc.firstAt >= PERSIST_MS) return { verdict: 'user-side', reason: `só esta conta, há ${Math.round((inc.lastAt - inc.firstAt) / 60_000)} min, com o servidor verde` };
  return { verdict: 'suppress', reason: 'uma conta só, checagens verdes, ainda não persistiu 10 min' };
}

export interface OutageState { down: boolean; since: number; failing: string[] }
export type OutageEvent = { type: 'down'; failing: string[] } | { type: 'recovered'; downMs: number } | { type: 'none' };

// Down/up edges only: an outage is announced once and closed once, never re-sent per tick.
export function stepOutage(state: OutageState, failing: Check[], nowMs: number): { state: OutageState; event: OutageEvent } {
  const ids = failing.map((c) => c.id);
  if (ids.length && !state.down) return { state: { down: true, since: nowMs, failing: ids }, event: { type: 'down', failing: ids } };
  if (!ids.length && state.down) return { state: { down: false, since: nowMs, failing: [] }, event: { type: 'recovered', downMs: nowMs - state.since } };
  return { state: state.down ? { ...state, failing: ids } : state, event: { type: 'none' } };
}

export const initialOutage = (): OutageState => ({ down: false, since: 0, failing: [] });

const CLIENT_CAUSES: Record<string, string> = {
  'relay-unreachable': 'cache de DNS antigo no aparelho, aba aberta há muito tempo com bundle velho, VPN/firewall corporativo bloqueando WebSocket',
  'login-refused': 'sessão expirada no aparelho ou relógio do aparelho errado',
  'box-offline': 'a box do usuário desligada, sem rede ou com o agente parado',
  'handshake-silent': 'a box do usuário conectada mas travada, ou aba com bundle velho',
  'js-error': 'extensão do navegador ou aba com bundle velho',
};

export function userSideMessage(inc: Incident, reason: string): string {
  const cause = CLIENT_CAUSES[inc.kind] ?? 'rede ou navegador do usuário';
  return [
    `Triagem ${inc.id}: ${inc.kind} só na conta ${inc.accountId.slice(0, 8)} (${inc.count} relatório(s))`,
    `Servidor verde visto daqui: ${reason}.`,
    `Causa provável do lado do cliente: ${cause}.`,
    'Sugerir: recarregar a aba (Ctrl+Shift+R), trocar de rede ou desligar a VPN, limpar o cache de DNS.',
  ].join('\n');
}

// A single blip (one dropped DNS packet, one ssh hiccup) is not an outage: a check only
// counts as failing if it fails again on a re-run a few seconds later.
export async function confirmFailing(runOnce: () => Promise<Check[]>, sleep: () => Promise<void>): Promise<Check[]> {
  const first = await runOnce();
  if (!first.length) return [];
  await sleep();
  const again = await runOnce();
  const ids = new Set(first.map((c) => c.id));
  return again.filter((c) => ids.has(c.id));
}
