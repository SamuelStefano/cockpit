import type { ReactNode } from 'react';
import { Bit } from '../bit/Bit';
import { isVirtualKeyboardOnly } from './touch';
import { navigateTo } from '../../lib/route-nav';
import { DECK_GUIDE_PROMPT } from '../../lib/deck-guide-prompt';

interface ChatEmptyProps {
  onPrompt: (text: string) => void;
  // Phone: a tap while scrolling fired a real agent turn. There the chip
  // fills the composer instead.
  onSeed?: (text: string) => void;
  suggestions?: string[];
  // The composer, centered between the question and the chips.
  children?: ReactNode;
  needsProvider?: boolean;
}

const FALLBACK_SUGGESTIONS = [
  'Resumir o que mudou esta semana',
  'Escrever um rascunho de post',
  'Revisar um texto que vou colar',
];

export function ChatEmpty({ onPrompt, onSeed, suggestions = FALLBACK_SUGGESTIONS, children, needsProvider = false }: ChatEmptyProps) {
  const pick = (text: string) => (onSeed && isVirtualKeyboardOnly() ? onSeed(text) : onPrompt(text));
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-3 pb-10 text-center">
      <Bit state="wave" size={72} className="fade-up mb-5" />
      <h2 className="fade-up mb-6 px-3 text-[26px] font-semibold tracking-tight text-neutral-100 pointer-coarse:text-[22px]">Em que vamos trabalhar?</h2>
      {needsProvider && (
        <p className="fade-up -mt-3 mb-5 text-[13px] text-neutral-400">
          Nenhum provedor conectado ainda.{' '}
          <a
            href="/onboarding" onClick={(e) => { e.preventDefault(); navigateTo('/onboarding'); }}
            className="text-orange-400 underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
          >
            Conectar um provedor
          </a>
        </p>
      )}
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
      {onSeed && (
        <button
          type="button"
          onClick={() => onSeed(DECK_GUIDE_PROMPT)}
          className="mt-4 text-[13px] text-neutral-500 underline-offset-2 transition-colors hover:text-orange-400 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          Pergunte ao Deck como configurar
        </button>
      )}
    </div>
  );
}
