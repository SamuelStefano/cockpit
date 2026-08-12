import { Icon, type IconName } from './Icon';
import { tokens } from './tokens';

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
  icon?: IconName;
}

// Linha de preferência liga/desliga: ícone + rótulo + dica + trilho. Usada nos
// menus (perfil) onde o toggle precisa explicar o que faz antes de ser clicado.
export function Switch({ checked, onChange, label, hint, icon }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-left transition hover:border-neutral-700 ${tokens.focusRing}`}
    >
      {icon && <Icon name={icon} size={13} className="shrink-0 text-neutral-400" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-neutral-200">{label}</span>
        {hint && <span className="block text-[10.5px] text-neutral-500">{hint}</span>}
      </span>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${checked ? 'bg-orange-500/80' : 'bg-neutral-700'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${checked ? 'left-3.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
