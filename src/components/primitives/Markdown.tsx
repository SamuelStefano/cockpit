import React from 'react';
import { splitFences } from './markdown/split-fences';
import { proseBlocks } from './markdown/prose-blocks';
import { CodeBlock } from './CodeBlock';

interface MarkdownProps {
  md: string;
  caret?: boolean;
}

export function Markdown({ md, caret = false }: MarkdownProps) {
  const segs = splitFences(md);
  let lastProse = -1;
  for (let i = segs.length - 1; i >= 0; i--) { if (segs[i].t === 'prose') { lastProse = i; break; } }
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-neutral-300">
      {segs.map((s, si) =>
        s.t === 'code'
          ? <CodeBlock key={`seg${si}`} code={s.code} lang={s.lang || undefined} />
          : <React.Fragment key={`seg${si}`}>{proseBlocks(s.text, `s${si}`, caret && si === lastProse)}</React.Fragment>
      )}
    </div>
  );
}
