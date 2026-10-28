import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoxInfo } from '../../../shared/boxes';
import { DIAG_PAYLOAD_MAX, payloadBytes, redactText, redactValue } from '../../../shared/diag';
import type { SealState } from '../../cockpit/sealed-socket';
import { supabase } from '../../lib/supabase';
import { loadedEntry } from '../app-update';
import { getLastClose, recentConnEvents } from '../connectionTelemetry';
import type { ConnCause } from './connectionCause';
import { createIncidentScheduler } from './incidentScheduler';

// What the reporter hook last saw; the profile-menu button reads it too.
export interface DiagSnapshot {
  cause: ConnCause | null;
  conn: string;
  seal: SealState;
  authRejected: boolean;
  agentOnline: boolean;
  offlineSince: number | null;
  wsHost: string;
  box: BoxInfo | null;
  boxes: BoxInfo[];
}

let snapshot: DiagSnapshot | null = null;
export function setDiagSnapshot(s: DiagSnapshot): void { snapshot = s; }
export function getDiagSnapshot(): DiagSnapshot | null { return snapshot; }

export const scheduler = createIncidentScheduler();

export interface DiagRow {
  source: 'browser';
  kind: string;
  box_id: string | null;
  app_version: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
}

const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : null);

// Everything is redacted, then the oldest events go until the payload fits the
// column's cap (the check in migration 0008 would refuse the row otherwise).
export function buildDiagRow(kind: string, snap: DiagSnapshot | null, extra: Record<string, unknown> = {}, now = Date.now()): DiagRow {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const close = getLastClose();
  const base = {
    at: new Date(now).toISOString(),
    cause: snap?.cause ?? null,
    conn: snap?.conn ?? null,
    seal: snap?.seal ?? null,
    authRejected: snap?.authRejected ?? null,
    agentOnline: snap?.agentOnline ?? null,
    offlineSince: iso(snap?.offlineSince),
    wsHost: snap?.wsHost ?? null,
    box: snap?.box ?? null,
    boxes: (snap?.boxes ?? []).slice(0, 20).map((b) => ({ id: b.id, label: b.label, online: b.online, lastSeen: b.lastSeen })),
    lastClose: close ? { code: close.code, reason: close.reason, at: iso(close.at) } : null,
    online: nav?.onLine ?? null,
    visible: typeof document !== 'undefined' ? document.visibilityState : null,
    page: typeof location !== 'undefined' ? location.pathname : null,
    extra,
  };
  let events = recentConnEvents().map((e) => ({ ...e, at: iso(e.at) }));
  let payload = redactValue({ ...base, events }) as Record<string, unknown>;
  while (payloadBytes(payload) > DIAG_PAYLOAD_MAX - 1024 && events.length) {
    events = events.slice(Math.ceil(events.length / 4));
    payload = redactValue({ ...base, events, eventsTrimmed: true }) as Record<string, unknown>;
  }
  if (payloadBytes(payload) > DIAG_PAYLOAD_MAX - 1024) payload = { at: base.at, cause: base.cause, oversize: true };
  return {
    source: 'browser',
    kind,
    box_id: snap?.box?.id ?? null,
    app_version: (loadedEntry() ?? 'dev').slice(0, 120),
    user_agent: nav ? redactText(nav.userAgent).slice(0, 400) : null,
    payload,
  };
}

// Straight to Supabase with the user's own session: it works while the relay is
// down, and RLS (0008) lets it only add rows about this account.
export async function sendDiagReport(kind: string, extra: Record<string, unknown> = {}, client: SupabaseClient | null = supabase): Promise<boolean> {
  if (!client) return false;
  try {
    const { data } = await client.auth.getSession();
    if (!data.session) return false;
    const { error } = await client.from('diag_reports').insert(buildDiagRow(kind, snapshot, extra));
    return !error;
  } catch { return false; }
}
