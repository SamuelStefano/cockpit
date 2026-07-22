import React from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { renderInline } from './render-inline';
import { headingSlug } from './slug';
import { classifyBlock } from './classify-block';

export function proseBlocks(md: string, keyBase: string, caret: boolean): ReactNode[] {
  const blocks = md.split('\n\n');
  const lastIdx = blocks.length - 1;
  return blocks.map((block, idx) => {
    const showCaret = caret && idx === lastIdx;
    const k = `${keyBase}-${idx}`;
    const node = classifyBlock(block);

    if (node.kind === 'hr') {
      return <hr key={k} className="border-neutral-800" />;
    }

    if (node.kind === 'heading') {
      const level = node.level;
      // pt-* dá respiro ACIMA do heading (mais que o space-y do bloco) pra a seção
      // se destacar como tópico. Tamanhos ficam acima do corpo (15.5px) — senão
      // ##/### viram texto meio-negrito e o doc "perde os tópicos".
      const cls = level === 1 ? 'pt-2 text-[20px] font-semibold text-neutral-50'
        : level === 2 ? 'pt-2 text-[17px] font-semibold text-neutral-100'
        : level === 3 ? 'pt-1 text-[16px] font-semibold text-neutral-200'
        : 'pt-1 text-[12.5px] font-semibold uppercase tracking-wide text-neutral-400';
      return React.createElement(
        `h${level}`,
        { key: k, id: headingSlug(node.text), className: `scroll-mt-4 ${cls}` },
        renderInline(node.text, `${k}-h`),
        showCaret ? <span key={`${k}-caret`} className="caret" /> : null,
      );
    }

    if (node.kind === 'table') {
      const { header, rows } = node;
      return (
        <div key={k} className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>{header.map((h, hi) => (
                <th key={hi} className="border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-left font-semibold text-neutral-200">{renderInline(h, `${k}-th${hi}`)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>{header.map((_, ci) => (
                  <td key={ci} className="border border-neutral-800 px-2.5 py-1.5 align-top text-neutral-300">{renderInline(r[ci] ?? '', `${k}-td${ri}-${ci}`)}</td>
                ))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (node.kind === 'blockquote') {
      const qlines = node.lines;
      return (
        <blockquote key={k} className="border-l-2 border-orange-500/40 pl-3 text-neutral-400 [text-wrap:pretty]">
          {qlines.map((l, li) => (
            <React.Fragment key={li}>{renderInline(l, `${k}-q${li}`)}{li < qlines.length - 1 && <br />}</React.Fragment>
          ))}
          {showCaret && <span className="caret" />}
        </blockquote>
      );
    }

    if (node.kind === 'list') {
      const { items, ordered, task: isTask } = node;
      if (isTask) {
        return (
          <ul key={k} className="space-y-1 [text-wrap:pretty]">
            {items.map((it, li) => (
              <li key={li} className="flex items-start gap-2" style={it.depth ? { marginLeft: it.depth * 16 } : undefined}>
                {it.done === null ? (
                  <span className="mt-[3px] inline-block h-3.5 w-3.5 shrink-0" />
                ) : (
                  <span className={`mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${it.done ? 'border-orange-500/50 bg-orange-500/20' : 'border-neutral-700 bg-neutral-900'}`}>
                    {it.done && <Icon name="check" size={9} className="text-orange-300" />}
                  </span>
                )}
                <span className={it.done ? 'text-neutral-500 line-through' : undefined}>{renderInline(it.text, `${k}-i${li}`)}</span>
              </li>
            ))}
          </ul>
        );
      }
      const ListTag = ordered ? 'ol' : 'ul';
      return (
        <ListTag key={k} className={`space-y-1 pl-5 [text-wrap:pretty] ${ordered ? 'list-decimal' : 'list-disc'} marker:text-neutral-500`}>
          {items.map((it, li) => (
            <li key={li} style={it.depth ? { marginLeft: it.depth * 16 } : undefined}>{renderInline(it.text, `${k}-i${li}`)}</li>
          ))}
        </ListTag>
      );
    }

    return (
      <p key={k} className="[text-wrap:pretty]">
        {node.lines.map((line, li) => (
          <React.Fragment key={li}>
            {renderInline(line, `${k}-${li}`)}
            {li < node.lines.length - 1 && <br />}
          </React.Fragment>
        ))}
        {showCaret && <span className="caret" />}
      </p>
    );
  });
}
