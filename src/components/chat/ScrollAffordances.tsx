import { Icon, tokens } from '../primitives';

interface ScrollAffordancesProps {
  // Prompt do usuário rolou pra fora da viewport: só então "voltar ao meu prompt"
  // significa alguma coisa.
  promptAbove: boolean;
  onScrollToPrompt: () => void;
  onScrollToBottom: () => void;
}

export function ScrollAffordances({ promptAbove, onScrollToPrompt, onScrollToBottom }: ScrollAffordancesProps) {
  return (
    <div className="fade-up absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
      {promptAbove && (
        <button
          type="button"
          onClick={onScrollToPrompt}
          title="Voltar ao meu prompt"
          className={`flex h-7 items-center gap-1 ${tokens.radius.full} border border-neutral-800/70 bg-neutral-900/60 px-2.5 text-[11px] font-medium text-neutral-500 opacity-60 backdrop-blur-sm transition hover:border-orange-500/30 hover:text-orange-200 hover:opacity-100 ${tokens.focusRing}`}
        >
          <Icon name="arrowUp" size={11} /> meu prompt
        </button>
      )}
      <button
        type="button"
        onClick={onScrollToBottom}
        title="Ir para o fim"
        className={`flex h-8 w-8 items-center justify-center ${tokens.radius.full} border border-neutral-700 bg-neutral-800 text-neutral-300 shadow-lg shadow-black/40 transition hover:bg-neutral-700 hover:text-neutral-100 ${tokens.focusRing}`}
      >
        <Icon name="chevronDown" size={16} />
      </button>
    </div>
  );
}
