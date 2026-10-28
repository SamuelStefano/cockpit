// Identified diagnostic reports (diag_reports, relay migration 0008). Shared by the
// SPA (browser reports), the agent (boot-after-crash report) and the relay (which
// validates the agent frame and inserts it with the service role).

export const DIAG_PAYLOAD_MAX = 64_000;
export const AGENT_DIAG_LINES = 80;
export const AGENT_DIAG_LINE_MAX = 400;
export const DIAG_KIND_MAX = 40;

const KIND = /^[a-z][a-z0-9_-]{0,39}$/;

export function isDiagKind(v: unknown): v is string {
  return typeof v === 'string' && KIND.test(v);
}

// Order matters: the JWT and bearer rules run before the generic long-secret rule
// so the label says what was removed.
const RULES: Array<[RegExp, string]> = [
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]'],
  [/\b(bearer[.\s]+)[A-Za-z0-9._~+/=-]{12,}/gi, '$1[token]'],
  [/\b(sk-ant-|sk-|ghp_|gho_|github_pat_|xox[abp]-|sbp_|eyJ)[A-Za-z0-9_-]{10,}/g, '[secret]'],
  [/([?&](?:token|code|key|secret|access_token|refresh_token|apikey)=)[^&\s"']+/gi, '$1[redacted]'],
  [/("?(?:token|access_token|refresh_token|apikey|api_key|secret|password|enrollCode|pairCode|privateKeyPem|key)"?\s*[:=]\s*"?)[^"\s,}]{4,}/gi, '$1[redacted]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[private-key]'],
  [/\b(?:[A-Za-z2-7]{4}-){5,}[A-Za-z2-7]{1,4}\b/g, '[enroll-code]'],
  [/\b(DECK_(?:PAIR|DEVICE)_CODE=)\S+/g, '$1[redacted]'],
];

export function redactText(s: string): string {
  let out = s;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

// Deep redaction of a JSON-able value: every string goes through redactText, and
// keys that name a secret lose their value outright.
const SECRET_KEY = /^(token|access_token|refresh_token|apikey|api_key|secret|password|jwt|authorization|enrollcode|paircode|privatekeypem)$/i;

export function redactValue(v: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth]';
  if (typeof v === 'string') return redactText(v);
  if (Array.isArray(v)) return v.map((x) => redactValue(x, depth + 1));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = SECRET_KEY.test(k) ? '[redacted]' : redactValue(x, depth + 1);
    return out;
  }
  return v;
}

export function payloadBytes(v: unknown): number {
  return new TextEncoder().encode(JSON.stringify(v)).length;
}

export interface AgentDiagFrame { t: 'diag-report'; kind: string; lines: string[]; version?: string }

// The relay trusts nothing in the frame: kind is a short slug, lines are capped
// in count and length, redacted again, and the whole thing must fit the column cap.
export function parseAgentDiag(raw: unknown): { kind: string; payload: { lines: string[]; version?: string } } | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.t !== 'diag-report' || !isDiagKind(m.kind) || !Array.isArray(m.lines)) return null;
  if (m.lines.length > AGENT_DIAG_LINES) return null;
  const lines: string[] = [];
  for (const l of m.lines) {
    if (typeof l !== 'string') return null;
    lines.push(redactText(l.slice(0, AGENT_DIAG_LINE_MAX)));
  }
  const payload: { lines: string[]; version?: string } = { lines };
  if (typeof m.version === 'string' && /^[0-9a-f]{7,40}$/.test(m.version)) payload.version = m.version;
  if (payloadBytes(payload) > DIAG_PAYLOAD_MAX) return null;
  return { kind: m.kind, payload };
}
