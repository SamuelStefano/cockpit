import type { ReactNode } from 'react';
import { Icon, type IconName } from '../primitives';
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

const SUGGESTION_ICONS: IconName[] = ['clipboard', 'pencil', 'eye'];

export function ChatEmpty({ onPrompt, onSeed, suggestions = FALLBACK_SUGGESTIONS, children, needsProvider = false }: ChatEmptyProps) {
  const pick = (text: string) => (onSeed && isVirtualKeyboardOnly() ? onSeed(text) : onPrompt(text));
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 pb-10">
      <div className="min-h-6 flex-[6]" />
      <div className="bit-pop bit-greet mb-3"><Bit state="wave" size={96} title="Bora?" /></div>
      <h2 className="fade-up mb-7 px-3 text-center font-display text-[41px] font-bold leading-none tracking-normal text-neutral-50 pointer-coarse:text-[32px]">O que vamos trabalhar hoje?</h2>
      {needsProvider && (
        <p className="fade-up -mt-3 mb-5 text-center text-[13px] text-neutral-400">
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
      <div className="stagger-fade mt-5 flex w-full max-w-[760px] flex-col px-1">
        {suggestions.slice(0, 3).map((text, i) => (
          <button
            key={text}
            type="button"
            onClick={() => pick(text)}
            className="flex h-14 items-center gap-3.5 rounded-2xl px-4 text-left text-[16px] text-neutral-300 transition-colors hover:bg-neutral-800/60 hover:text-neutral-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
          >
            <Icon name={SUGGESTION_ICONS[i % SUGGESTION_ICONS.length]} size={18} className="shrink-0 text-orange-400" />
            <span className="min-w-0 truncate">{text}</span>
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
      <div className="min-h-0 flex-[4]" />
    </div>
  );
}
