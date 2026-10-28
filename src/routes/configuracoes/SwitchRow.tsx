import { ListRow } from '../../components/primitives';

export function SwitchRow({ label, hint, checked, onChange, danger = false }: { label: string; hint?: string; checked: boolean; onChange: () => void; danger?: boolean }) {
  return (
    <ListRow
      label={label}
      hint={hint}
      trailing={
        <button
          type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}
          className={`relative h-5 w-9 shrink-0 rounded-full transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${checked ? (danger ? 'bg-red-500/80' : 'bg-orange-500/80') : 'bg-neutral-700'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      }
    />
  );
}
