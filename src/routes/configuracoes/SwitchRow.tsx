import { ListRow } from '../../components/primitives';

// The whole row is the switch; the track is only a visual.
export function SwitchRow({ label, hint, checked, onChange, danger = false }: { label: string; hint?: string; checked: boolean; onChange: () => void; danger?: boolean }) {
  return (
    <ListRow
      label={label}
      hint={hint}
      onClick={onChange}
      switchChecked={checked}
      className="pointer-coarse:min-h-14"
      trailing={
        <span aria-hidden className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? (danger ? 'bg-red-500/80' : 'bg-orange-500/80') : 'bg-neutral-700'}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
      }
    />
  );
}
