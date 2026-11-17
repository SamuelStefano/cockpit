import { Icon } from '../primitives';

export function SidePanelButton({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-label={open ? 'Hide team panel' : 'Show team panel'}
      title="Team panel"
      className={`relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border bg-neutral-900 text-neutral-300 hover:border-orange-500/50 ${open ? 'border-orange-500/60 text-orange-300' : 'border-neutral-800'}`}
    >
      <Icon name="panelRight" size={16} />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-orange-500 px-1 text-center text-[11px] font-semibold leading-4 text-neutral-950">{count}</span>
      )}
    </button>
  );
}
