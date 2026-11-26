import type { BoxInfo } from '../../../../shared/boxes';
import { NO_UNREAD, type BoxUnread } from '../../../cockpit/box-unread';
import { boxLabel } from '../../../cockpit/boxes-store';
import { Button, tokens } from '../../primitives';
import { BoxDot } from '../../sessions/BoxDot';

interface BoxSwitcherPopoverProps {
  boxes: BoxInfo[];
  active: string | null;
  unread: Record<string, BoxUnread>;
  onSelect: (id: string) => void;
  onHealth: () => void;
  onAdd: () => void;
}

export function BoxSwitcherPopover({ boxes, active, unread, onSelect, onHealth, onAdd }: BoxSwitcherPopoverProps) {
  return (
    <div className="w-64 p-1.5">
      <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-(--text-muted)">Máquinas</div>
      <ul aria-label="Máquinas">
        {boxes.map((b) => {
          const u = unread[b.id] ?? NO_UNREAD;
          const count = u.red || u.white;
          return (
            <li key={b.id}>
              <button
                type="button" onClick={() => onSelect(b.id)} aria-current={b.id === active ? 'true' : undefined}
                className={`flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] ${tokens.focusRing} ${b.id === active ? 'bg-(--accent-tint) text-(--text)' : 'text-(--text-body) hover:bg-neutral-800 hover:text-(--text)'}`}
              >
                <BoxDot online={b.online} />
                <span className="min-w-0 flex-1 truncate">{boxLabel(b)}</span>
                {b.id !== active && count > 0 && (
                  <span aria-label={`${count} ${u.red ? 'pedem você' : 'novas'}`} className={`h-4.25 min-w-4.25 rounded-full px-1 text-center text-[10px] font-semibold leading-4.25 ${u.red ? 'bg-red-500 text-white' : 'bg-neutral-100 text-neutral-900'}`}>{count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex flex-col gap-0.5 border-t border-(--border) pt-1.5">
        <Button variant="ghost" size="sm" icon="shield" onClick={onHealth} className="w-full justify-start">Saúde das máquinas</Button>
        <Button variant="ghost" size="sm" icon="plus" onClick={onAdd} className="w-full justify-start">Adicionar máquina</Button>
      </div>
    </div>
  );
}
