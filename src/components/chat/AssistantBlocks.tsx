import { useState, type ReactNode } from 'react';
import { Icon, Markdown, CodeBlock, tokens } from '../primitives';
import type { Block } from '../../data/mock';
import { ToolCallCard } from './ToolCallCard';
import { AskQuestionCard } from './AskQuestionCard';
import { isQuestionTool as isQuestion, isTodoTool } from './visible-blocks';

function ThinkingCard({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-violet-500/15 bg-violet-500/[0.04]">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Pensamento interno do modelo (extended thinking) — não faz parte da resposta final"
        className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 transition hover:text-neutral-300 ${tokens.focusRing}`}
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
  // answerable = última mensagem assistant + turno ocioso → AskUserQuestion clicável.
  answerable?: boolean;
  onAnswer?: (text: string) => void;
}

export function AssistantBlocks({ blocks, caretOnLast, answerable = false, onAnswer }: AssistantBlocksProps) {
  const lastIdx = blocks.length - 1;
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const node = renderBlock(b, i);
        // fade-up dispara uma vez na montagem (a key estável reusa o DOM), então
        // cada bloco surge macio ao aparecer sem re-animar a cada token streamado.
        return node && <div key={i} className="fade-up">{node}</div>;
      })}
    </div>
  );

  function renderBlock(b: Block, i: number): ReactNode {
    // As ferramentas comuns saíram daqui: collapseTurnTools junta as do turno
    // inteiro numa caixa só. Sobram as duas que precisam ficar no fluxo —
    // AskUserQuestion (o usuário tem que clicar pra desbloquear o turno) e a
    // lista de tarefas (progresso que ele acompanha ao vivo).
    if (b.type === 'tool') {
      if (isQuestion(b.tool)) return <AskQuestionCard tool={b.tool} answerable={answerable} onAnswer={onAnswer} />;
      if (isTodoTool(b.tool)) return <ToolCallCard tool={b.tool} />;
      return null;
    }
    if (b.type === 'text') return <Markdown md={b.md} caret={caretOnLast && i === lastIdx} />;
    if (b.type === 'code') return <CodeBlock code={b.code} lang={b.lang} />;
    if (b.type === 'thinking') return <ThinkingCard text={b.text} />;
    return null;
  }
}
