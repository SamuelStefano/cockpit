// Tokeniza markdown inline numa única passada: wikilink `[[x]]`, negrito,
// itálico, tachado, código, link `[txt](url)` e URL crua. A regra de precedência
// é a ordem das alternativas no regex (negrito antes de itálico, etc.). Puro e
// testável — o render só mapeia cada token pro seu nó.
export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'wikilink'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'strike'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'autolink'; url: string; trail: string }
  | { type: 'link'; label: string; url: string };

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /(\[\[[^\]\n]+\]\]|\*\*[^*]+\*\*|\*\S[^*\n]*?\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>)\]]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('[[')) tokens.push({ type: 'wikilink', value: tok.slice(2, -2) });
    else if (tok.startsWith('**')) tokens.push({ type: 'bold', value: tok.slice(2, -2) });
    else if (tok.startsWith('~~')) tokens.push({ type: 'strike', value: tok.slice(2, -2) });
    else if (tok.startsWith('*')) tokens.push({ type: 'italic', value: tok.slice(1, -1) });
    else if (tok.startsWith('`')) tokens.push({ type: 'code', value: tok.slice(1, -1) });
    else if (tok.startsWith('http')) {
      const trail = /[.,;:!?]+$/.exec(tok);
      const url = trail ? tok.slice(0, -trail[0].length) : tok;
      tokens.push({ type: 'autolink', url, trail: trail ? trail[0] : '' });
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      tokens.push({ type: 'link', label: mm[1], url: mm[2] });
    }
    last = m.index + tok.length;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  return tokens;
}
