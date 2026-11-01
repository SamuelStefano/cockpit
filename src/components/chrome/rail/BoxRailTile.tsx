import type { MouseEvent } from 'react';
import type { BoxInfo } from '../../../../shared/boxes';
import type { HealthLevel } from '../../../../shared/box-health';
import { boxLabel } from '../../../cockpit/boxes-store';
import { Tooltip } from '../../primitives';
import { railInitial, railTint } from '../sidebar/rail-chats';

interface Props {
  box: BoxInfo;
  active: boolean;
  level: HealthLevel | null;
  onOpen: (id: string) => void;
  onMenu: (e: MouseEvent<HTMLButtonElement>, id: string) => void;
}

export function BoxRailTile({ box, active, level, onOpen, onMenu }: Props) {
  const label = boxLabel(box);
  const status = box.online ? 'online' : 'offline';
  return (
    <div className="relative flex w-full justify-center">
      <span aria-hidden className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-orange-500 transition-all motion-reduce:transition-none ${active ? 'h-8' : 'h-0'}`} />
      <Tooltip label={`${label} · ${status}`} side="right">
        <button
          type="button"
          aria-label={`${label}, ${status}`}
          aria-current={active ? 'true' : undefined}
          onClick={() => onOpen(box.id)}
          onContextMenu={(e) => onMenu(e, box.id)}
          className={`relative flex h-11 w-11 items-center justify-center transition-[border-radius] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${active ? 'rounded-xl' : 'rounded-2xl hover:rounded-xl'} ${railTint(box.id)} ${box.online ? '' : 'opacity-50'}`}
        >
          <span className="font-display text-[17px] font-bold leading-none">{railInitial(label)}</span>
          <span aria-hidden className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-neutral-950 ${box.online ? 'bg-green-500' : 'bg-neutral-600'}`} />
          {(level === 'warn' || level === 'error') && (
            <span role="img" aria-label={`Saúde: ${level === 'error' ? 'erro' : 'atenção'}`} className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-neutral-950 ${level === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
