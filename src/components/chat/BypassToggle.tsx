import { Icon } from '../primitives';

// Switch admin-only de bypassPermissions (#94, DR-011). Só é renderizado quando
// o servidor anuncia canBypass (admin + flag de env + loopback) — o caller já
// gateia por isso. Default OFF; o backend reimpõe via bypassAllowed. Visual de
// alerta: bypass = o agente roda QUALQUER comando sem pedir.
export function BypassToggle({ on, setOn, disabled }: { on: boolean; setOn: (b: boolean) => void; disabled: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => setOn(!on)}
      title={on
        ? 'BYPASS LIGADO — o agente roda qualquer comando sem aprovação. Desligue quando terminar.'
        : 'Bypass de permissões (admin): o agente roda qualquer comando sem pedir. Use com cuidado.'}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50
        ${on
          ? 'border-red-500/50 bg-red-500/15 text-red-300 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.4)]'
          : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300'}`}
    >
      <Icon name={on ? 'shield-off' : 'shield'} size={12} />
      bypass
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-red-400' : 'bg-neutral-700'}`} />
    </button>
  );
}
