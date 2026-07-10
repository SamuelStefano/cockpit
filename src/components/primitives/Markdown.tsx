import React, { useMemo } from 'react';
import { splitFences } from './markdown/split-fences';
import { proseBlocks } from './markdown/prose-blocks';
import { CodeBlock } from './CodeBlock';

interface MarkdownProps {
  md: string;
  caret?: boolean;
}

// memo + useMemo: o tokenizer roda no caminho quente de streaming (re-render a cada
// delta). Sem isto, toda mensagem grande é re-fatiada/re-tokenizada por frame e em
// qualquer re-render do pai. Re-parseia só quando `md` muda de fato.
function MarkdownImpl({ md, caret = false }: MarkdownProps) {
  const { segs, lastProse } = useMemo(() => {
    const s = splitFences(md);
    let lp = -1;
    for (let i = s.length - 1; i >= 0; i--) { if (s[i].t === 'prose') { lp = i; break; } }
    return { segs: s, lastProse: lp };
  }, [md]);
  return (
    <div className="space-y-4 text-[15.5px] leading-7 text-neutral-300">
      {segs.map((s, si) =>
        s.t === 'code'
          ? <CodeBlock key={`seg${si}`} code={s.code} lang={s.lang || undefined} />
          : <React.Fragment key={`seg${si}`}>{proseBlocks(s.text, `s${si}`, caret && si === lastProse)}</React.Fragment>
      )}
    </div>
  );
}

export const Markdown = React.memo(MarkdownImpl);
