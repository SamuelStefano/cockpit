import type { ReactNode } from 'react';

export function Highlight({ text, term }: { text: string; term?: string }) {
  const q = term?.trim();
  if (!q || q.length < 2) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let hit = lower.indexOf(needle);
  let k = 0;
  while (hit >= 0) {
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push(
      <mark key={k++} className="rounded-[2px] bg-orange-500/25 px-0.5 text-orange-200">
        {text.slice(hit, hit + q.length)}
      </mark>,
    );
    i = hit + q.length;
    hit = lower.indexOf(needle, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return <>{parts}</>;
}
