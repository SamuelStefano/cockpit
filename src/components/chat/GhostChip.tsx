// Phone: the completion suggestion sits on its own row above the box. Inline it
// competed with the caret for the tap at the end of the text.
export function GhostChip({ ghostShown, acceptGhost }: { ghostShown: string; acceptGhost: () => void }) {
  return (
    <button
      type="button" onClick={acceptGhost} onPointerDown={(e) => e.preventDefault()}
      className="fade-up mb-1.5 flex h-9 max-w-full items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-3 text-left text-[13px] text-neutral-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
    >
      <span className="shrink-0 text-neutral-500">Completar:</span>
      <span className="min-w-0 truncate">{ghostShown.trim()}</span>
    </button>
  );
}
