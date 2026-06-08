import type { ReactNode } from 'react';
import { tokenizeInline } from './tokenize-inline';

// Allowlist de esquema pra href de link markdown. O conteúdo vem do modelo / saída
// de tool (não-confiável): um `[clique](javascript:...)` viraria âncora que executa
// script no clique. Só http(s)/mailto e caminhos relativos passam; o resto perde o
// href (vira texto puro). data: também fica de fora (data:text/html é vetor de XSS).
function safeHref(url: string): string | undefined {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[/#?]/.test(u) || /^[\w.-]+(\/|$)/.test(u)) return u; // relativo (sem esquema)
  return undefined;
}

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
        nodes.push(
          <span key={key} className="rounded bg-orange-500/10 px-1 py-px font-medium text-orange-300/90 ring-1 ring-inset ring-orange-500/20">
            {t.value}
          </span>
        );
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
