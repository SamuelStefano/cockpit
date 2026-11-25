// A string worth offering as a clickable file: no spaces, no URL, and either a
// directory separator or a short extension. The server is the real gate.
export function looksLikePath(s: string): boolean {
  if (!s || s.length > 300 || /\s/.test(s) || /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return false;
  if (/[<>|*?"`$;&()]/.test(s)) return false;
  if (s.split('/').some((seg) => seg === '..')) return false;
  const base = s.split('/').pop() ?? '';
  if (!/^[\w@.+~-]+$/.test(base)) return false;
  const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(base) && /[A-Za-z]/.test(base.split('.').pop() ?? '');
  return hasExt && (s.includes('/') || /^[A-Za-z_][\w-]*\.[A-Za-z0-9]{1,8}$/.test(base) || base.startsWith('.'));
}

// Path-first token of a tool card's command (Read/Edit/Write carry just the path).
export function toolPath(command: string): string | null {
  const p = command.trim();
  return looksLikePath(p) ? p : null;
}
