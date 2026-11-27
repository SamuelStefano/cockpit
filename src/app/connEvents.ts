// Ring of recent connection events for the identified diag report (diag_reports).
// Never sent by the anonymous beacon; the report redacts it before it leaves. No
// DOM or app imports: the sealed socket records into it too.
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

export function resetConnEvents(): void { events = []; lastDialAt = 0; lastRelayFrameAt = 0; }
