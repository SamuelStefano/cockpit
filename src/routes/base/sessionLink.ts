const PARAM = 'session';
const ID_RE = /^[\w-]{1,80}$/;

export function parseSessionParam(search: string): string | null {
  const v = new URLSearchParams(search).get(PARAM);
  return v !== null && ID_RE.test(v) ? v : null;
}

// Path, query and hash with the session param set or removed; other params are kept.
export function withSessionParam(href: string, id: string | null): string {
  const u = new URL(href);
  if (id !== null && ID_RE.test(id)) u.searchParams.set(PARAM, id); else u.searchParams.delete(PARAM);
  return u.pathname + u.search + u.hash;
}
