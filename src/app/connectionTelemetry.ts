import { wsBase } from '../cockpit/session';

export type ReportKind = 'ws_offline' | 'ws_recovered' | 'auth_rejected';
export type UaFamily = 'chrome' | 'firefox' | 'safari' | 'edge' | 'other';

export interface ConnectionReport {
  v: 1;
  kind: ReportKind;
  closeCode?: number;
  closeReason?: string;
  offlineMs?: number;
  phase?: 'connecting' | 'reconnecting' | 'down';
  online?: boolean;
  visible?: boolean;
  app?: string;
  ua?: UaFamily;
  mobile?: boolean;
}

export const MAX_REPORTS_PER_PAGE = 10;
const MAX_REASON = 40;
const MAX_APP = 24;

// Ring of recent connection events for the identified diag report (diag_reports).
// Never sent by the anonymous beacon above; the report redacts it before it leaves.
export interface ConnEvent { at: number; ev: string; [field: string]: unknown }
export const CONN_EVENTS_MAX = 200;
let events: ConnEvent[] = [];
let lastDialAt = 0;
let lastRelayFrameAt = 0;

export function recordConnEvent(ev: string, fields: Record<string, unknown> = {}): void {
  const at = Date.now();
  if (ev === 'dial') lastDialAt = at;
  events.push({ ...fields, at, ev });
  if (events.length > CONN_EVENTS_MAX) events = events.slice(-CONN_EVENTS_MAX);
}
export function recentConnEvents(): ConnEvent[] { return events.slice(); }

// A relay-owned frame (agent-online/offline, boxes) proves the relay answered.
export function noteRelayFrame(t: string, fields: Record<string, unknown> = {}): void {
  lastRelayFrameAt = Date.now();
  recordConnEvent(`relay:${t}`, fields);
}
export function relayAnsweredSinceDial(): boolean { return lastRelayFrameAt > 0 && lastRelayFrameAt >= lastDialAt; }

let lastClose: { code: number; reason: string; at: number } | null = null;
export function recordClose(code: number, reason: string): void {
  lastClose = { code, reason: reason ?? '', at: Date.now() };
  recordConnEvent('close', { code, reason: (reason ?? '').slice(0, MAX_REASON) });
}
export function getLastClose(): { code: number; reason: string; at: number } | null { return lastClose; }

export function uaFamily(ua: string): UaFamily {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'edge';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox';
  if (/Chrome\/|CriOS\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'other';
}

export function isMobileUa(ua: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function int(n: unknown, max = 2_147_483_647): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : undefined;
}

export function buildReport(input: Partial<ConnectionReport> & { kind: ReportKind }): ConnectionReport {
  const r: ConnectionReport = { v: 1, kind: input.kind };
  const code = int(input.closeCode, 65535);
  if (code !== undefined) r.closeCode = code;
  if (typeof input.closeReason === 'string' && input.closeReason) r.closeReason = input.closeReason.slice(0, MAX_REASON);
  const ms = int(input.offlineMs);
  if (ms !== undefined) r.offlineMs = ms;
  if (input.phase === 'connecting' || input.phase === 'reconnecting' || input.phase === 'down') r.phase = input.phase;
  if (typeof input.online === 'boolean') r.online = input.online;
  if (typeof input.visible === 'boolean') r.visible = input.visible;
  if (typeof input.app === 'string' && input.app) r.app = input.app.slice(0, MAX_APP);
  if (input.ua) r.ua = input.ua;
  if (typeof input.mobile === 'boolean') r.mobile = input.mobile;
  return r;
}

// wss://host/path -> https://host/telemetry; null unless the backend is a remote wss relay.
export function telemetryUrl(base: string = wsBase()): string | null {
  try {
    const u = new URL(base);
    if (u.protocol !== 'wss:') return null;
    const h = u.hostname.replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h === '::1' || h === '0.0.0.0' || /^127\./.test(h) || h.endsWith('.localhost')) return null;
    return `https://${u.host}/telemetry`;
  } catch { return null; }
}

let sent = 0;
let offlineSentForEpisode = false;
export function resetTelemetryForTests(): void { sent = 0; offlineSentForEpisode = false; lastClose = null; events = []; lastDialAt = 0; lastRelayFrameAt = 0; }
export function endOfflineEpisode(): void { offlineSentForEpisode = false; }

export function sendConnectionReport(report: ConnectionReport, url: string | null = telemetryUrl()): boolean {
  try {
    if (!url || sent >= MAX_REPORTS_PER_PAGE) return false;
    if (report.kind === 'ws_offline') {
      if (offlineSentForEpisode) return false;
      offlineSentForEpisode = true;
    }
    sent++;
    const json = JSON.stringify(report);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      && navigator.sendBeacon(url, new Blob([json], { type: 'text/plain' }))) return true;
    void fetch(url, { method: 'POST', body: json, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
    return true;
  } catch { return false; }
}

export function reportContext(): Pick<ConnectionReport, 'online' | 'visible' | 'ua' | 'mobile'> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : '';
  return {
    online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    visible: typeof document !== 'undefined' ? document.visibilityState === 'visible' : undefined,
    ua: uaFamily(ua),
    mobile: isMobileUa(ua),
  };
}
