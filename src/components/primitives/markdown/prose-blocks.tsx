import React from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { renderInline } from './render-inline';
import { headingSlug } from './slug';

export function proseBlocks(md: string, keyBase: string, caret: boolean): ReactNode[] {
  const blocks = md.split('\n\n');
  const lastIdx = blocks.length - 1;
  return blocks.map((block, idx) => {
    const showCaret = caret && idx === lastIdx;
    const lines = block.split('\n');
    const k = `${keyBase}-${idx}`;

    if (lines.length === 1 && /^(?:-{3,}|\*{3,}|_{3,})$/.test(block.trim())) {
      return <hr key={k} className="border-neutral-800" />;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(block.trim());
    if (heading && lines.length === 1) {
      const level = heading[1].length;
      const cls = level === 1 ? 'text-[17px] font-semibold text-neutral-100'
        : level === 2 ? 'text-[15px] font-semibold text-neutral-100'
        : level === 3 ? 'text-[14px] font-semibold text-neutral-200'
        : 'text-[13px] font-semibold uppercase tracking-wide text-neutral-400';
      return React.createElement(
        `h${level}`,
        { key: k, id: headingSlug(heading[2]), className: `scroll-mt-4 ${cls}` },
        renderInline(heading[2], `${k}-h`),
        showCaret ? <span key={`${k}-caret`} className="caret" /> : null,
      );
    }

    // Tabela GFM: header + separador |---|:--:| + linhas. Claude emite tabela
    // o tempo todo (comparações, schemas); sem isto vinha como texto cru.
    if (
      lines.length >= 2 &&
      lines[0].includes('|') &&
      lines[1].includes('-') &&
      /^[\s|:-]+$/.test(lines[1].trim())
    ) {
      const cells = (l: string) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const header = cells(lines[0]);
      const rows = lines.slice(2).map(cells);
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

    if (block.trim().startsWith('>')) {
      const inner = lines.map((l) => l.replace(/^\s*>\s?/, '')).join('\n');
      return (
        <blockquote key={k} className="border-l-2 border-orange-500/40 pl-3 text-neutral-400 [text-wrap:pretty]">
          {inner.split('\n').map((l, li) => (
            <React.Fragment key={li}>{renderInline(l, `${k}-q${li}`)}{li < inner.split('\n').length - 1 && <br />}</React.Fragment>
          ))}
          {showCaret && <span className="caret" />}
        </blockquote>
      );
    }

    const isOrdered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
    const isUnordered = lines.every((l) => /^\s*[-*]\s+/.test(l));
    if ((isOrdered || isUnordered) && lines.length > 0 && lines[0].trim() !== '') {
      const items = lines.map((l) => {
        const text = l.replace(/^\s*(?:\d+\.|[-*])\s+/, '');
        const task = /^\[([ xX])\]\s+(.*)$/.exec(text);
        return {
          depth: Math.min(4, Math.floor((/^\s*/.exec(l)![0].length) / 2)),
          text: task ? task[2] : text,
          done: task ? task[1].toLowerCase() === 'x' : null,
        };
      });
      // Task list GFM (- [ ] / - [x]): Claude emite to-dos o tempo todo; sem
      // isto vinham com `[ ]`/`[x]` crus. Marcadores viram checkbox visual.
      const isTask = isUnordered && items.some((it) => it.done !== null);
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
      const ListTag = isOrdered ? 'ol' : 'ul';
      return (
        <ListTag key={k} className={`space-y-1 pl-5 [text-wrap:pretty] ${isOrdered ? 'list-decimal' : 'list-disc'} marker:text-neutral-500`}>
          {items.map((it, li) => (
            <li key={li} style={it.depth ? { marginLeft: it.depth * 16 } : undefined}>{renderInline(it.text, `${k}-i${li}`)}</li>
          ))}
        </ListTag>
      );
    }

    return (
      <p key={k} className="[text-wrap:pretty]">
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {renderInline(line, `${k}-${li}`)}
            {li < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
        {showCaret && <span className="caret" />}
      </p>
    );
  });
}
