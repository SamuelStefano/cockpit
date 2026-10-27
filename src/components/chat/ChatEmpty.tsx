import type { ReactNode } from 'react';
import { Bit } from '../bit/Bit';
import { isVirtualKeyboardOnly } from './touch';

interface ChatEmptyProps {
  onPrompt: (text: string) => void;
  // Phone: a tap while scrolling fired a real agent turn. There the chip
  // fills the composer instead.
  onSeed?: (text: string) => void;
  suggestions?: string[];
  // The composer, centered between the question and the chips.
  children?: ReactNode;
}

const FALLBACK_SUGGESTIONS = [
  'Resumir o que mudou esta semana',
  'Escrever um rascunho de post',
  'Revisar um texto que vou colar',
];

export function ChatEmpty({ onPrompt, onSeed, suggestions = FALLBACK_SUGGESTIONS, children }: ChatEmptyProps) {
  const pick = (text: string) => (onSeed && isVirtualKeyboardOnly() ? onSeed(text) : onPrompt(text));
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-3 pb-10 text-center">
      <Bit state="wave" size={72} className="fade-up mb-5" />
      <h2 className="fade-up mb-6 px-3 text-[26px] font-semibold tracking-tight text-neutral-100 pointer-coarse:text-[22px]">Em que vamos trabalhar?</h2>
      {children && <div className="w-full">{children}</div>}
      <div className="stagger-fade mt-2 flex max-w-[760px] flex-wrap justify-center gap-2 px-3">
        {suggestions.slice(0, 3).map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => pick(text)}
            className="inline-flex h-8 items-center rounded-full border border-neutral-700 px-3 text-[13px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
