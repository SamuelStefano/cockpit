// Parser tolerante de frontmatter YAML-ish compartilhado pelos surfacers
// READ-ONLY (contexts/memory + skills). description é uma linha física (longa,
// possivelmente entre aspas). O regex tolera indentação de propósito — assim
// `type:` aninhado sob `metadata:` é lido sem precisar de YAML completo.

export interface Fm { name?: string; description?: string; type?: string }

export function parseFrontmatter(text: string): Fm {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  const block = end >= 0 ? text.slice(3, end) : text.slice(3);
  const fm: Fm = {};
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)([a-zA-Z_]+):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const [, indent, key, valRaw] = m;
    let val = unquote(valRaw.trim());
    // YAML block scalar (`description: >-` then indented lines): the value is the
    // following more-indented lines. Without this the UI showed a literal ">-".
    if (/^[>|][+-]?$/.test(val)) {
      const parts: string[] = [];
      while (i + 1 < lines.length && (lines[i + 1].trim() === '' || /^\s*/.exec(lines[i + 1])![0].length > indent.length)) {
        parts.push(lines[++i].trim());
      }
      val = parts.filter(Boolean).join(' ');
    }
    if (key === 'name' && !fm.name) fm.name = val;
    else if (key === 'description' && !fm.description) fm.description = val;
    else if (key === 'type' && !fm.type) fm.type = val;
  }
  return fm;
}

export function unquote(s: string): string {
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
  return s;
}

export function stripFrontmatter(raw: string): string {
  if (!raw.startsWith('---')) return raw;
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return raw;
  const after = raw.indexOf('\n', end + 1);
  return after >= 0 ? raw.slice(after + 1).replace(/^\s+/, '') : '';
}
