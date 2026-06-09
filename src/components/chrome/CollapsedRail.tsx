import { Icon } from '../primitives';

// Rail fino que ocupa o lugar de um painel recolhido — clicar reexpande.
export function CollapsedRail({ side, label, icon, onExpand }: {
  side: 'left' | 'right'; label: string; icon: Parameters<typeof Icon>[0]['name']; onExpand: () => void;
}) {
  return (
    <button
      onClick={onExpand}
      title={`Mostrar ${label}`}
      className={`group flex w-9 shrink-0 flex-col items-center gap-2 bg-neutral-950 py-3 text-neutral-500 transition hover:bg-neutral-900 hover:text-neutral-200 ${side === 'left' ? 'border-r' : 'border-l'} border-neutral-800`}
    >
      <Icon name={side === 'left' ? 'chevronRight' : 'chevronLeft'} size={15} />
      <Icon name={icon} size={14} className="text-neutral-600 group-hover:text-orange-400" />
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-600 [writing-mode:vertical-rl]">{label}</span>
    </button>
  );
}
