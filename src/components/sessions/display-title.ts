const URL_RE = /\bhttps?:\/\/([^\s/?#]+)[^\s]*/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Leading noise from raw first prompts: emoji, bullets, dots, dashes, quotes, markdown marks.
const LEAD_RE = /^[\s\p{Extended_Pictographic}️‍.,;:!?\-–—*_#>`'"~•·|]+/u;
const TRAIL_RE = /[\s.,;:\-–—(]+$/;

// Sidebar label for a session title. Titles are often the raw first prompt ("faça meu daily…",
// ". - nao responder", a bare link), so the list reads as noise; this keeps the words and drops
// the clutter. Display only: the stored title is untouched.
export function displayTitle(raw: string): string {
  const cleaned = raw
    .replace(URL_RE, (_, host: string) => host.replace(/^www\./, ''))
    .replace(UUID_RE, '')
    .replace(/[*_`#]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(LEAD_RE, '')
    .replace(TRAIL_RE, '')
    .trim();
  if (!cleaned) return raw.trim() || 'Sem título';
  return cleaned.charAt(0).toLocaleUpperCase('pt-BR') + cleaned.slice(1);
}
