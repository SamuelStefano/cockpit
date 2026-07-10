import { Icon, tokens } from '../primitives';

// Tópicos de continuação pós-turno (estilo ChatGPT): chips selecionáveis logo
// após a última resposta. Clicar envia o tópico como próximo prompt; o X dispensa.
// Efêmeros por design — somem quando um turno novo começa.
export function FollowupChips({ items, onPick, onDismiss }: {
  items: string[];
  onPick: (text: string) => void;
  onDismiss: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="fade-up mx-auto flex w-full max-w-3xl flex-wrap items-center gap-1.5 px-4 pb-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className={`group flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-[12px] text-neutral-400 transition hover:border-orange-500/40 hover:bg-neutral-900 hover:text-orange-200 ${tokens.focusRing}`}
        >
          <Icon name="arrowUp" size={11} className="rotate-45 text-neutral-600 transition group-hover:text-orange-400" />
          {s}
        </button>
      ))}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dispensar sugestões"
        title="Dispensar sugestões"
        className={`flex h-6 w-6 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300 ${tokens.focusRing}`}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
