import { tokens } from '../primitives';
import type { ToolCall } from '../../data/types';
import { letterFor } from './letter-shortcut';
import { useBotQuestionCard } from './useBotQuestionCard';

interface BotQuestionCardProps {
  tool: ToolCall;
  answerable: boolean;
  onAnswer?: (text: string) => boolean | void;
}

// A bot's decision, Grok-style: bold question, lettered options. A click or a
// bare A–D sends the option as the human's next message; typing anything else in
// the composer answers too.
export function BotQuestionCard({ tool, answerable, onAnswer }: BotQuestionCardProps) {
  const { question, open, picked, pick } = useBotQuestionCard(tool, answerable, onAnswer);
  if (!question) return null;
  return (
    <div className="my-2 rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3.5">
      <p className="mb-2 text-[15px] font-semibold leading-snug text-neutral-100">{question.question}</p>
      <div role="group" aria-label={question.question} className="flex flex-col">
        {question.options.map((opt, i) => (
          <button key={i} type="button" onClick={() => pick(i)} disabled={!open}
            aria-keyshortcuts={open ? letterFor(i) : undefined}
            className={`flex items-start gap-3 rounded-lg px-1.5 py-2 text-left transition ${tokens.focusRing} ${open ? 'hover:bg-neutral-800/70' : 'cursor-default'} ${picked === i ? 'bg-orange-500/10' : ''} ${!open && picked !== i ? 'opacity-60' : ''}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[12px] font-medium ${picked === i ? 'border-orange-500/60 text-orange-300' : 'border-neutral-700 text-neutral-400'}`}>
              {letterFor(i)}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-[14.5px] text-neutral-100">{opt.label}</span>
              {opt.description && <span className="block text-[13px] leading-snug text-neutral-500">{opt.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
