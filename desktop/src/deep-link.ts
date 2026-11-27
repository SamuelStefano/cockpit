export interface DeckLink {
  box: string | null;
  session: string;
}

const ID = /^[A-Za-z0-9_-]{1,200}$/;

// Any web page can fire deck://, so a link only ever selects a session.
export function parseDeckLink(raw: string): DeckLink | null {
  if (raw.length > 500 || !raw.startsWith('deck://') || raw.includes('..')) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.search || url.hash || url.username || url.password) return null;
  const parts = `${url.hostname}${url.pathname}`.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0] === 'c' && ID.test(parts[1])) return { box: null, session: parts[1] };
  if (parts.length === 4 && parts[0] === 'b' && parts[2] === 'c' && ID.test(parts[1]) && ID.test(parts[3])) {
    return { box: parts[1], session: parts[3] };
  }
  return null;
}

export function deckLinkFromArgv(argv: string[]): DeckLink | null {
  for (const arg of argv) {
    const link = parseDeckLink(arg);
    if (link) return link;
  }
  return null;
}
