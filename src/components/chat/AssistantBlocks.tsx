import { useState } from 'react';
import { Icon, Markdown, CodeBlock } from '../primitives';
import type { Block } from '../../data/mock';
import { ToolCallCard } from './ToolCallCard';

function ThinkingCard({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04]">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Pensamento interno do modelo (extended thinking) — não faz parte da resposta final"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300"
      >
        <Icon name="chevronRight" size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        <Icon name="zap" size={11} className="text-violet-400/70" />
        raciocínio interno
        {!open && <span className="ml-1 truncate font-normal text-neutral-600">{text.slice(0, 60)}…</span>}
      </button>
      {open && (
        <div className="border-t border-violet-500/15">
          <p className="px-3 pt-1.5 text-[10px] italic text-neutral-600">
            Pensamento interno do modelo — não é a resposta.
          </p>
          <pre className="scroll-thin max-h-64 overflow-y-auto whitespace-pre-wrap px-3 pb-2 pt-1 text-[11.5px] leading-snug text-neutral-400">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

interface AssistantBlocksProps {
  blocks: Block[];
  caretOnLast: boolean;
}

export function AssistantBlocks({ blocks, caretOnLast }: AssistantBlocksProps) {
  return (
    <div className="space-y-1">
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        if (b.type === 'text') return <Markdown key={i} md={b.md} caret={caretOnLast && isLast} />;
        if (b.type === 'code') return <CodeBlock key={i} code={b.code} lang={b.lang} />;
        if (b.type === 'tool') return <ToolCallCard key={i} tool={b.tool} />;
        if (b.type === 'thinking') return <ThinkingCard key={i} text={b.text} />;
        return null;
      })}
    </div>
  );
}
