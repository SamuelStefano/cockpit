import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, tokens } from '../primitives';
import { isTouchMobile } from './touch';

// Casca dos seletores por prompt (skills, MCP): bottom-sheet no celular, popover
// no desktop. A lista rola sozinha (flex + min-h-0) em vez de um max-height em
// `vh` — com o teclado virtual aberto o `vh` não encolhe e o fim da lista ficava
// atrás do teclado, sem chegar nos últimos itens.
//
// No celular sai por portal: aberto de dentro da folha de ajustes, o `fixed` herdava
// o composer (backdrop-blur vira containing block) e a lista era cortada em cima e
// embaixo — o título da primeira skill e o fim da última sumiam.
export function PickerSheet({ label, query, setQuery, placeholder, onClear, onClose, footer, children }: {
  label: string;
  query: string;
  setQuery: (q: string) => void;
  placeholder: string;
  onClear: (() => void) | null;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const touch = isTouchMobile();
  const sheet = (
    <>
      <div data-picker-sheet="" className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={onClose} />
      <div
        data-picker-sheet=""
        role="dialog"
        aria-label={label}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col rounded-t-2xl border border-neutral-700 bg-neutral-900 pb-[env(safe-area-inset-bottom)] shadow-xl shadow-black/50 sm:absolute sm:bottom-full sm:left-0 sm:inset-x-auto sm:mb-2 sm:max-h-80 sm:w-72 sm:rounded-lg sm:pb-0"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-2">
          <Icon name="search" size={13} className="shrink-0 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            // No celular o foco abriria o teclado por cima da lista antes de a pessoa ler.
            autoFocus={!touch}
            className="w-full bg-transparent text-[12.5px] text-neutral-100 placeholder-neutral-600 outline-hidden"
          />
          {onClear && (
            <button
              onClick={onClear}
              className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10.5px] text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
            >
              limpar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={`Fechar ${label.toLowerCase()}`}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 sm:hidden ${tokens.focusRing}`}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overscroll-contain overflow-y-auto py-1">
          {children}
        </div>
        <div className="shrink-0 border-t border-neutral-800 px-3 py-2 text-[10.5px] leading-snug text-neutral-500">
          {footer}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`m-2 shrink-0 rounded-lg bg-orange-500/20 py-2 text-[13px] font-medium text-orange-200 transition hover:bg-orange-500/30 sm:hidden ${tokens.focusRing}`}
        >
          Pronto
        </button>
      </div>
    </>
  );
  // Largura, não toque: iPad e notebook com tela sensível passam do `sm` e usam o
  // popover ancorado (`sm:absolute`), que no <body> iria parar fora do lugar.
  const narrow = typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 639.98px)')?.matches ?? false);
  return narrow ? createPortal(sheet, document.body) : sheet;
}
