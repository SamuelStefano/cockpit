import type { Check } from './checks.ts';
import type { Incident } from './incidents.ts';

export const MULTI_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;
export const ANNOUNCE_AFTER_MS = 5 * 60 * 1000;
// Only a report a person filed on purpose earns the trusted-reporter shortcut.
const TRUSTED_KIND = 'manual';
const ROUTINE_KINDS: ReadonlySet<string> = new Set(['login-refused', 'unclean-exit', 'js-error']);

export type Verdict =
  | { verdict: 'confirmed'; reason: string; trusted?: string }
  | { verdict: 'suppress'; reason: string };

// A browser report alone proves nothing (a laptop on hotel wifi files one too). Only a
// failure seen from this VPS or several accounts at once earns a message. One account alone
// never does, and neither do kinds that fire during routine use (expired session, agent
// restart, browser extension): a real login outage is caught by login_path and auth_flow.
// A trusted reporter (owner, partner) skips the wait, but only for a `manual` report:
// auto-filed reports (a laptop that lost wifi) never escalate on that basis.
export function decide(inc: Incident, synthFailing: Check[], all: Incident[], nowMs: number, trusted: ReadonlySet<string> = new Set()): Verdict {
  const t = inc.email && trusted.has(inc.email.toLowerCase()) ? inc.email : undefined;
  if (synthFailing.length) return { verdict: 'confirmed', reason: `checagem sintética falhando: ${synthFailing.map((c) => c.id).join(', ')}`, trusted: t };
  if (t && inc.kind === TRUSTED_KIND) return { verdict: 'confirmed', reason: `reportado por ${t} (confiável)`, trusted: t };
  if (ROUTINE_KINDS.has(inc.kind)) return { verdict: 'suppress', reason: `${inc.kind} é rotina com checagens verdes` };
  const accounts = new Set(all.filter((o) => o.kind === inc.kind && nowMs - o.lastAt <= MULTI_ACCOUNT_WINDOW_MS).map((o) => o.accountId));
  if (accounts.size >= 2) return { verdict: 'confirmed', reason: `${accounts.size} contas com ${inc.kind} em 10 min` };
  return { verdict: 'suppress', reason: 'uma conta só, checagens verdes' };
}

export interface OutageState { down: boolean; since: number; failing: string[]; announced: boolean }
export type OutageEvent =
  | { type: 'opened'; failing: string[] }
  | { type: 'down'; failing: string[] }
  | { type: 'recovered'; downMs: number; announced: boolean }
  | { type: 'none' };

// Down/up edges only: an outage is announced once, only after it has lasted ANNOUNCE_AFTER_MS,
// and closed once. A blip that recovers before the announcement is a `recovered` with
// announced=false: the caller logs it and sends nothing.
export function stepOutage(state: OutageState, failing: Check[], nowMs: number, announceAfterMs = ANNOUNCE_AFTER_MS): { state: OutageState; event: OutageEvent } {
  const ids = failing.map((c) => c.id);
  if (ids.length && !state.down) return { state: { down: true, since: nowMs, failing: ids, announced: false }, event: { type: 'opened', failing: ids } };
  if (!ids.length && state.down) return { state: { down: false, since: nowMs, failing: [], announced: false }, event: { type: 'recovered', downMs: nowMs - state.since, announced: state.announced } };
  if (ids.length && state.down && !state.announced && nowMs - state.since >= announceAfterMs) return { state: { ...state, failing: ids, announced: true }, event: { type: 'down', failing: ids } };
  return { state: state.down ? { ...state, failing: ids } : state, event: { type: 'none' } };
}

export const initialOutage = (): OutageState => ({ down: false, since: 0, failing: [], announced: false });

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
