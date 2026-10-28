import type { ReactNode } from 'react';

const MENTION = /(^|[\s(])(@[\p{L}\p{N}_-]+)/gu;

export function renderMentions(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <span key={start} className="rounded-md bg-orange-500/15 px-1.5 font-medium text-orange-400">{m[2]}</span>,
    );
    last = start + m[2].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
