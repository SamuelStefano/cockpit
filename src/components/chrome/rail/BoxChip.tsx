import { boxLabel } from '../../../cockpit/boxes-store';
import { Popover, Tooltip, tokens } from '../../primitives';
import { initials } from '../../avatar/initials';
import { useBoxChip } from './useBoxChip';
import { BoxSwitcherPopover } from './BoxSwitcherPopover';

// The box this tab talks to, under the logo; other boxes' unread rides on it.
export function BoxChip({ onAdd }: { onAdd: () => void }) {
  const { s, unread, other, select, add } = useBoxChip(onAdd);
  if (!s.visible) return null;
  const label = s.current ? boxLabel(s.current) : 'Máquina';
  const count = other.red || other.white;
  return (
    <Popover
      open={s.open} onClose={s.close} side="right" align="start" label="Trocar de máquina"
      content={<BoxSwitcherPopover boxes={s.sorted} active={s.active} unread={unread} onSelect={select} onHealth={s.openHealth} onAdd={add} />}
    >
      <Tooltip label={`Máquina: ${label}`} side="right" className="flex">
        <button
          type="button" onClick={() => s.setOpen(!s.open)} aria-haspopup="dialog" aria-expanded={s.open} aria-label={`Máquina: ${label}`}
          className={`relative mb-1 flex h-11 w-11 items-center justify-center rounded-xl border border-(--border-strong) bg-neutral-900 text-[13px] font-semibold text-(--text-body) transition hover:text-(--text) ${tokens.focusRing}`}
        >
          {initials(label) || 'M'}
          <span aria-hidden className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-950 ${s.current?.online ? 'bg-green-500' : 'bg-neutral-600'}`} />
          {count > 0 && (
            <span aria-label={`${count} em outras máquinas`} className={`absolute -right-1.5 -top-1.5 h-4.25 min-w-4.25 rounded-full px-1 text-center text-[10px] font-semibold leading-4.25 ${other.red ? 'bg-red-500 text-white' : 'bg-neutral-100 text-neutral-900'}`}>{count}</span>
          )}
        </button>
      </Tooltip>
    </Popover>
  );
}
