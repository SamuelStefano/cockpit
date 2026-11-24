const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SHORT = '[0-9a-f]{8}';

export const SESSION_REF_RE = new RegExp(`(?<![\\w-])(?:${UUID}|${SHORT})(?![\\w-])`, 'gi');

export type SessionPart = { type: 'text'; value: string } | { type: 'ref'; value: string };

// Splits prose around id-shaped tokens; whether one is a real session is the resolver's call.
export function splitSessionRefs(text: string): SessionPart[] {
  const parts: SessionPart[] = [];
  let last = 0;
  for (const m of text.matchAll(SESSION_REF_RE)) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    parts.push({ type: 'ref', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

// A full id matches exactly; an 8-char prefix only when it is unambiguous.
export function resolveSessionRef(ref: string, ids: readonly string[]): string | null {
  const r = ref.toLowerCase();
  const exact = ids.find((id) => id.toLowerCase() === r);
  if (exact) return exact;
  if (r.length !== 8) return null;
  const hits = ids.filter((id) => id.toLowerCase().startsWith(r));
  return hits.length === 1 ? hits[0] : null;
}
