import { Badge, Button } from '../primitives';
import { useArmed } from '../primitives/useArmed';
import { fmtDay, type DeviceItem } from '../../cockpit/useDevices';

export function DeviceRow({ d, onRevoke }: { d: DeviceItem; onRevoke: (pub: string) => void }) {
  const { armed, fire } = useArmed();
  return (
    <li className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 grow">
        <p className="flex items-center gap-1.5 truncate text-[12.5px] text-neutral-200">
          <span className="truncate">{d.label}</span>
          {d.current && <Badge tone="orange">este aparelho</Badge>}
        </p>
        <p className="text-[11px] text-neutral-500">desde {fmtDay(d.addedAt)} · visto {fmtDay(d.lastSeen)}</p>
      </div>
      <Button variant={armed ? 'danger' : 'ghost'} size="sm" onClick={() => fire(() => onRevoke(d.pub))}>
        {armed ? 'confirmar?' : 'revogar'}
      </Button>
    </li>
  );
}
