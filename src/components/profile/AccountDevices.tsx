import { boxLabel } from '../../cockpit/boxes-store';
import { useBoxes } from '../../cockpit/useBoxes';
import { Icon } from '../primitives';
import { BoxDot } from '../sessions/BoxDot';

// "Fleet" in the account menu: the machines this account reaches, the
// current one checked; picking another switches the Deck to it.
export function AccountDevices({ onDone, onManage }: { onDone: () => void; onManage?: () => void }) {
  const { known, boxes, active, switchBox } = useBoxes();
  if (!known || boxes.length === 0) return null;
  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <p className="text-[12px] font-medium text-neutral-500">Fleet</p>
      <ul role="menu" aria-label="Fleet" className="mt-1 max-h-40 overflow-y-auto">
        {boxes.map((b) => (
          <li key={b.id}>
            <button
              type="button" role="menuitemradio" aria-checked={b.id === active}
              onClick={() => { if (b.id !== active) switchBox(b.id); onDone(); }}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12.5px] text-neutral-200 hover:bg-neutral-800/60"
            >
              <BoxDot online={b.online} />
              <span className="min-w-0 flex-1 truncate">{boxLabel(b)}</span>
              {b.id === active && <Icon name="check" size={13} className="shrink-0 text-orange-400" />}
            </button>
          </li>
        ))}
      </ul>
      {onManage && (
        <button type="button" onClick={() => { onManage(); onDone(); }} className="mt-1 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12.5px] text-neutral-300 hover:bg-neutral-800/60">
          <Icon name="smartphone" size={13} />
          Conexões › Aparelhos
        </button>
      )}
    </div>
  );
}
