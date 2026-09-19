import type { PlanUsage, PlanLimit } from '../../shared/protocol';
import { readOAuthToken, OAUTH_BETA } from '../oauth';

// Second source for the plan usage. The usage endpoint answers 429 with a one-hour
// Retry-After and renews it on every probe (18/09/2026: nine refusals in a row, the
// bar blind from 14h to 23h). Every /v1/messages answer carries the same account
// numbers in its `anthropic-ratelimit-unified-*` headers, so a one-token request
// reads them without touching the endpoint that is refusing.
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const PROBE_MODEL = process.env.COCKPIT_USAGE_PROBE_MODEL ?? 'claude-haiku-4-5-20251001';
const PROBE_SYSTEM = "You are Claude Code, Anthropic's official CLI for Claude.";
const PROBE_TIMEOUT_MS = 15_000;

export interface HeaderUsage {
  fiveHour: number;
  sevenDay: number;
  resetsAt: number | null;
  sevenDayResetsAt: number | null;
  fiveHourStatus: string;
  sevenDayStatus: string;
}

function ratio(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n * 100))) : null;
}

function epochMs(v: string | null): number | null {
  const n = Number(v);
  return v !== null && Number.isFinite(n) && n > 0 ? n * 1000 : null;
}

export function mapUnifiedHeaders(h: { get(name: string): string | null }): HeaderUsage | null {
  const fiveHour = ratio(h.get('anthropic-ratelimit-unified-5h-utilization'));
  const sevenDay = ratio(h.get('anthropic-ratelimit-unified-7d-utilization'));
  if (fiveHour === null || sevenDay === null) return null;
  return {
    fiveHour,
    sevenDay,
    resetsAt: epochMs(h.get('anthropic-ratelimit-unified-5h-reset')),
    sevenDayResetsAt: epochMs(h.get('anthropic-ratelimit-unified-7d-reset')),
    fiveHourStatus: h.get('anthropic-ratelimit-unified-5h-status') ?? 'allowed',
    sevenDayStatus: h.get('anthropic-ratelimit-unified-7d-status') ?? 'allowed',
  };
}

function severityOf(status: string, pct: number): PlanLimit['severity'] {
  if (status === 'rejected' || pct >= 90) return 'critical';
  if (status === 'allowed_warning' || pct >= 75) return 'warning';
  return 'normal';
}

// The headers know the two account windows and nothing about per-model ceilings, so
// scoped rows are kept from the last full read instead of vanishing from the panel.
export function mergeHeaderUsage(prev: PlanUsage | null, h: HeaderUsage): PlanUsage {
  const session: PlanLimit = { id: 'session-0', label: 'Sessão (5h)', pct: h.fiveHour, resetsAt: h.resetsAt, severity: severityOf(h.fiveHourStatus, h.fiveHour), scoped: false };
  const weekly: PlanLimit = { id: 'weekly_all-1', label: 'Semanal', pct: h.sevenDay, resetsAt: h.sevenDayResetsAt, severity: severityOf(h.sevenDayStatus, h.sevenDay), scoped: false };
  const prevLimits = prev?.limits ?? [];
  const isSession = (l: PlanLimit) => l.id.startsWith('session-');
  const isWeekly = (l: PlanLimit) => l.id.startsWith('weekly_all-');
  const limits = prevLimits.length
    ? prevLimits.map((l) => (isSession(l) ? { ...session, id: l.id } : isWeekly(l) ? { ...weekly, id: l.id } : l))
    : [session, weekly];
  if (prevLimits.length && !prevLimits.some(isSession)) limits.unshift(session);
  if (prevLimits.length && !prevLimits.some(isWeekly)) limits.push(weekly);
  return { fiveHour: h.fiveHour, sevenDay: h.sevenDay, resetsAt: h.resetsAt, sevenDayResetsAt: h.sevenDayResetsAt, limits };
}

// The unified headers come back on refusals too (a 429 from the messages API still
// says how full the windows are), so the status code is not checked.
export async function fetchUsageFromHeaders(): Promise<HeaderUsage | null> {
  const token = await readOAuthToken();
  if (!token) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(MESSAGES_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': OAUTH_BETA,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: PROBE_MODEL, max_tokens: 1, system: PROBE_SYSTEM, messages: [{ role: 'user', content: '.' }] }),
      signal: ac.signal,
    });
    void res.body?.cancel().catch(() => {});
    return mapUnifiedHeaders(res.headers);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
