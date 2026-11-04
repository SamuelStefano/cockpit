import type { MouseEvent } from 'react';
import type { BoxInfo } from '../../../../shared/boxes';
import type { HealthLevel } from '../../../../shared/box-health';
import type { BoxUnread } from '../../../cockpit/box-unread';
import { boxLabel } from '../../../cockpit/boxes-store';
import { Icon, Tooltip } from '../../primitives';
import { railInitial, railTint } from '../sidebar/rail-chats';

interface Props {
  box: BoxInfo;
  active: boolean;
  level: HealthLevel | null;
  unread: BoxUnread;
  onOpen: (id: string) => void;
  onMenu: (e: MouseEvent<HTMLButtonElement>, id: string) => void;
}

export function railTileLabel(label: string, status: string, unread: BoxUnread): string {
  const parts = [label, status];
  if (unread.locked) parts.push('este aparelho não está cadastrado');
  if (unread.red) parts.push(`${unread.red} aguardando você`);
  if (unread.white) parts.push(`${unread.white} com novidade`);
  return parts.join(' · ');
}

export function BoxRailTile({ box, active, level, unread, onOpen, onMenu }: Props) {
  const label = boxLabel(box);
  const status = box.online ? 'online' : 'offline';
  const pill = active ? 'h-8' : unread.white || unread.red ? 'h-2' : 'h-0';
  return (
    <div className="relative flex w-full justify-center">
      <span aria-hidden className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-orange-500 transition-all motion-reduce:transition-none ${pill}`} />
      <Tooltip label={railTileLabel(label, status, unread)} side="right">
        <button
          type="button"
          aria-label={railTileLabel(label, status, unread).replace(' · ', ', ')}
          aria-current={active ? 'true' : undefined}
          onClick={() => onOpen(box.id)}
          onContextMenu={(e) => onMenu(e, box.id)}
          className={`relative flex h-11 w-11 items-center justify-center transition-[border-radius] motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40 ${active ? 'rounded-xl' : 'rounded-2xl hover:rounded-xl'} ${railTint(box.id)} ${box.online ? '' : 'opacity-50'}`}
        >
          <span className="font-display text-[17px] font-bold leading-none">{railInitial(label)}</span>
          {unread.red > 0 ? (
            <span aria-hidden className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-neutral-950">{unread.red > 99 ? '99+' : unread.red}</span>
          ) : unread.locked ? (
            <span aria-hidden className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-neutral-800 text-neutral-300 ring-2 ring-neutral-950"><Icon name="lock" size={9} /></span>
          ) : (
            <span aria-hidden className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-neutral-950 ${box.online ? 'bg-green-500' : 'bg-neutral-600'}`} />
          )}
          {(level === 'warn' || level === 'error') && (
            <span role="img" aria-label={`Saúde: ${level === 'error' ? 'erro' : 'atenção'}`} className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-neutral-950 ${level === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
          )}
        </button>
      </Tooltip>
    </div>
  );
}
