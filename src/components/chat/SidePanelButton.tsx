import { Icon } from '../primitives';

export function SidePanelButton({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-label={open ? 'Esconder painel' : 'Mostrar painel'}
      title="Painel"
      className={`mr-1.5 flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px] font-semibold hover:border-orange-500/70 ${open ? 'border-orange-500/60 bg-orange-500/20 text-orange-300' : 'border-orange-500/30 bg-orange-500/10 text-orange-400'}`}
    >
      <Icon name="panelRight" size={14} />
      Painel
      {count > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">{count}</span>}
    </button>
  );
}
