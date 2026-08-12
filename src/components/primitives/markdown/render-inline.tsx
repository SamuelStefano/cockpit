import type { ReactNode } from 'react';
import { tokenizeInline } from './tokenize-inline';
import { WikiLink } from './wikilink-context';
import { safeHref } from '../../../lib/safe-href';

export function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  for (const t of tokenizeInline(text)) {
    const key = `${keyBase}-${i++}`;
    switch (t.type) {
      case 'text':
        nodes.push(<span key={key}>{t.value}</span>);
        break;
      case 'wikilink':
        nodes.push(<WikiLink key={key} value={t.value} />);
        break;
      case 'bold':
        nodes.push(<strong key={key} className="font-semibold text-neutral-100">{t.value}</strong>);
        break;
      case 'strike':
        nodes.push(<span key={key} className="text-neutral-500 line-through">{t.value}</span>);
        break;
      case 'italic':
        nodes.push(<em key={key} className="italic text-neutral-200">{t.value}</em>);
        break;
      case 'code':
        nodes.push(
          <code key={key} className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[0.86em] text-orange-300">
            {t.value}
          </code>
        );
        break;
      case 'autolink':
        nodes.push(
          <a key={key} href={t.url} target="_blank" rel="noreferrer"
            className="break-all text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400">
            {t.url}
          </a>
        );
        if (t.trail) nodes.push(<span key={`${key}-tp`}>{t.trail}</span>);
        break;
      case 'link': {
        const href = safeHref(t.url);
        nodes.push(
          href === undefined ? (
            <span key={key}>{t.label}</span>
          ) : (
            <a key={key} href={href} target="_blank" rel="noreferrer"
              className="text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:decoration-orange-400">
              {t.label}
            </a>
          )
        );
        break;
      }
    }
  }
  return nodes;
}
