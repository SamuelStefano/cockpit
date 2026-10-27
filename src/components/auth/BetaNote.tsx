import { Icon } from '../primitives';

export function BetaNote() {
  return (
    <p className="mt-6 flex gap-2 text-[12px] leading-relaxed text-neutral-600">
      <Icon name="alertTriangle" size={12} className="mt-0.5 shrink-0" />
      <span>
        <span className="font-medium text-neutral-500">Beta · relay confiável.</span> Por enquanto o relay é
        operado pela DevFellowship — ele encaminha sua sessão pra sua VPS, mas tecnicamente vê o tráfego.
        A verificação ponta-a-ponta (relay sem poder forjar comandos) entra antes de abrir pra VPSs de terceiros.
      </span>
    </p>
  );
}
