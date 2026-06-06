import type { ReactNode } from 'react';

export function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*\S[^*\n]*?\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s<>)\]]+)/g;
  let last = 0, i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={`${keyBase}-t${i++}`}>{text.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-b${i++}`} className="font-semibold text-neutral-100">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('~~')) {
      nodes.push(<span key={`${keyBase}-s${i++}`} className="text-neutral-500 line-through">{tok.slice(2, -2)}</span>);
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={`${keyBase}-i${i++}`} className="italic text-neutral-200">{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith('`')) {
      nodes.push(
        <code key={`${keyBase}-c${i++}`} className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[0.86em] text-orange-300">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith('http')) {
      const trail = /[.,;:!?]+$/.exec(tok);
      const url = trail ? tok.slice(0, -trail[0].length) : tok;
      nodes.push(
        <a key={`${keyBase}-u${i++}`} href={url} target="_blank" rel="noreferrer"
          className="break-all text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400">
          {url}
        </a>
      );
      if (trail) nodes.push(<span key={`${keyBase}-tp${i++}`}>{trail[0]}</span>);
    } else {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      nodes.push(
        <a key={`${keyBase}-l${i++}`} href={mm[2]} target="_blank" rel="noreferrer"
          className="text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400">
          {mm[1]}
        </a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(<span key={`${keyBase}-t${i++}`}>{text.slice(last)}</span>);
  return nodes;
}
