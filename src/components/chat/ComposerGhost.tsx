import { composerMaxH } from './fit-height';

// Sugestão fantasma (cinza) desenhada ATRÁS do textarea, alinhada caractere a
// caractere com o texto já digitado.
export function ComposerGhost({ value, ghostShown, acceptGhost, chip = true }: {
  value: string;
  ghostShown: string;
  acceptGhost: () => void;
  // False on phones: the suggestion is a chip above the box instead (GhostChip).
  chip?: boolean;
}) {
  return (
    <div style={{ maxHeight: composerMaxH() }} className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap wrap-break-word py-1 pr-3 text-[15px] leading-7 text-neutral-600">
      <span aria-hidden className="invisible">{value}</span><span aria-hidden>{ghostShown}</span>
      {/* z-10 + pointer-events-auto: o chip fica clicável MESMO sob o textarea
          (que pinta por cima do overlay) — no mobile não existe Tab. */}
      {chip && <button
        type="button" tabIndex={-1} onClick={acceptGhost} aria-label={`Completar com: ${ghostShown}`}
        onPointerDown={(e) => e.preventDefault()}
        className="pointer-events-auto relative z-10 ml-1 rounded-sm border border-neutral-700 px-1 text-[12px] align-middle text-neutral-500 transition before:absolute before:-inset-2 before:content-[''] hover:border-orange-500/40 hover:text-orange-200"
      >
        <span className="sm:hidden">tocar</span><span className="hidden sm:inline">Tab</span>
      </button>}
    </div>
  );
}
