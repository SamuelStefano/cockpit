import { useState, type ReactNode } from 'react';
import { Icon, Markdown, CodeBlock } from '../primitives';
import { usePersisted } from '../../lib/persist';
import type { Block } from '../../data/mock';
import { ToolCallCard } from './ToolCallCard';
import { ToolGroupCard } from './ToolGroupCard';
import { AskQuestionCard } from './AskQuestionCard';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT } from '../../lib/prefs';

function isQuestion(t: { name?: string; questions?: unknown[] }) {
  return t.name === 'AskUserQuestion' && !!t.questions?.length;
}

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
  // answerable = última mensagem assistant + turno ocioso → AskUserQuestion clicável.
  answerable?: boolean;
  onAnswer?: (text: string) => void;
}

// Agrupa blocos de ferramenta CONSECUTIVOS num só item (renderiza como grupo) e
// preserva a ordem dos demais blocos. Texto/thinking entre tools quebram o grupo.
type Item =
  | { kind: 'block'; block: Block; i: number }
  | { kind: 'tools'; tools: Extract<Block, { type: 'tool' }>['tool'][]; i: number };

function groupBlocks(blocks: Block[]): Item[] {
  const items: Item[] = [];
  let run: Extract<Block, { type: 'tool' }>['tool'][] = [];
  let runStart = 0;
  const flush = () => {
    if (run.length) { items.push({ kind: 'tools', tools: run, i: runStart }); run = []; }
  };
  blocks.forEach((b, i) => {
    if (b.type === 'tool') {
      if (!run.length) runStart = i;
      run.push(b.tool);
    } else {
      flush();
      items.push({ kind: 'block', block: b, i });
    }
  });
  flush();
  return items;
}

export function AssistantBlocks({ blocks, caretOnLast, answerable = false, onAnswer }: AssistantBlocksProps) {
  const [showTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);
  const lastIdx = blocks.length - 1;
  return (
    <div className="space-y-1">
      {groupBlocks(blocks).map((it) => {
        if (it.kind === 'tools') {
          // AskUserQuestion sempre renderiza (mesmo com tools ocultas): é uma ação
          // que o usuário PRECISA ver pra desbloquear o turno. Demais tools seguem o
          // toggle showTools.
          const questions = it.tools.filter(isQuestion);
          const rest = it.tools.filter((t) => !isQuestion(t));
          const cards: ReactNode[] = [];
          questions.forEach((t, qi) => {
            cards.push(
              <AskQuestionCard key={`${it.i}-q${qi}`} tool={t} answerable={answerable} onAnswer={onAnswer} />,
            );
          });
          if (showTools && rest.length) {
            if (rest.length === 1) cards.push(<ToolCallCard key={`${it.i}-t`} tool={rest[0]} />);
            else cards.push(<ToolGroupCard key={`${it.i}-g`} tools={rest} />);
          }
          return cards.length ? <div key={it.i} className="space-y-1">{cards}</div> : null;
        }
        const b = it.block;
        const isLast = it.i === lastIdx;
        if (b.type === 'text') return <Markdown key={it.i} md={b.md} caret={caretOnLast && isLast} />;
        if (b.type === 'code') return <CodeBlock key={it.i} code={b.code} lang={b.lang} />;
        if (b.type === 'thinking') return <ThinkingCard key={it.i} text={b.text} />;
        return null;
      })}
    </div>
  );
}
