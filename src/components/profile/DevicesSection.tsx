import { useSealState } from '../auth/useEnrollDevice';
import { useDevices } from '../../cockpit/useDevices';
import { DeviceRow } from './DeviceRow';
import { ForgetBoxButton } from './ForgetBoxButton';

// Devices this box trusts. Revoking one closes its channel at once; revoking
// this one sends this browser back to enrollment.
export function DevicesSection() {
  const sealed = useSealState() === 'sealed';
  const { items, revoke, forget } = useDevices(sealed);
  if (!sealed) return null;
  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <p className="text-[12px] font-medium text-neutral-500">Aparelhos nesta VPS</p>
      {items === null
        ? <p className="mt-1 text-[11.5px] text-neutral-500">carregando…</p>
        : <ul className="mt-1 max-h-48 overflow-y-auto">{items.map((d) => <DeviceRow key={d.pub} d={d} onRevoke={revoke} />)}</ul>}
      <ForgetBoxButton onForget={forget} />
    </div>
  );
}
