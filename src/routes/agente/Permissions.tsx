import { Icon, tokens, type IconName } from '../../components/primitives';
import type { Perms } from './permissions';

const ITEMS: { key: keyof Perms; label: string; icon: IconName }[] = [
  { key: 'read', label: 'Ler', icon: 'file' },
  { key: 'write', label: 'Escrever', icon: 'pencil' },
  { key: 'net', label: 'Rede', icon: 'link' },
];

interface PermissionsProps {
  value: Perms;
  onChange: (next: Perms) => void;
  disabled?: boolean;
}

export function Permissions({ value, onChange, disabled = false }: PermissionsProps) {
  return (
    <div role="group" aria-label="Permissões" className="flex gap-2">
      {ITEMS.map((it) => {
        const on = value[it.key];
        return (
          <button key={it.key} type="button" role="switch" aria-checked={on} aria-label={it.label} disabled={disabled}
            onClick={() => onChange({ ...value, [it.key]: !on })}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-[13px] transition disabled:cursor-not-allowed disabled:opacity-60 ${tokens.focusRing} ${
              on ? 'border-neutral-700 bg-neutral-800/60 text-neutral-100' : 'border-neutral-800 text-neutral-500 hover:border-neutral-700'}`}>
            <Icon name={it.icon} size={13} />
            {it.label}
            <span className={`relative h-4 w-6.5 shrink-0 rounded-full transition ${on ? 'bg-orange-500/80' : 'bg-neutral-700'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
