import { ToggleChip } from '../primitives';

// Switch admin-only de bypassPermissions (#94, DR-011). Só é renderizado quando
// o servidor anuncia canBypass (admin + flag de env + loopback) — o caller já
// gateia por isso. Default OFF; o backend reimpõe via bypassAllowed. Visual de
// alerta: bypass = o agente roda QUALQUER comando sem pedir.
export function BypassToggle({ on, setOn }: { on: boolean; setOn: (b: boolean) => void }) {
  return (
    <ToggleChip
      on={on}
      tone="danger"
      icon={on ? 'shield-off' : 'shield'}
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      title={on
        ? 'BYPASS LIGADO — o agente roda qualquer comando sem aprovação. Desligar vale do próximo prompt (o turno em voo só para pelo Parar).'
        : 'Bypass de permissões (admin): o agente roda qualquer comando sem pedir. Use com cuidado.'}
    >
      bypass
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-red-400' : 'bg-neutral-700'}`} />
    </ToggleChip>
  );
}
