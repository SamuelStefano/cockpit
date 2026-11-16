import type { BoxInfo } from '../../../shared/boxes';
import type { HealthLevel } from '../../../shared/box-health';
import type { BoxUnread } from '../../cockpit/box-unread';
import { boxLabel } from '../../cockpit/boxes-store';
import { Badge, Button, IconButton } from '../../components/primitives';
import { BoxDot } from '../../components/sessions/BoxDot';
import { HealthBadge } from '../../components/health/HealthBadge';

interface Props {
  box: BoxInfo;
  active: boolean;
  level: HealthLevel | null;
  unread: BoxUnread;
  onOpen: () => void;
  onRename: () => void;
  onRevoke: () => void;
}

export function MachineRow({ box, active, level, unread, onOpen, onRename, onRevoke }: Props) {
  const label = boxLabel(box);
  return (
    <li className="flex items-center gap-2 border-t border-neutral-800 px-3 py-2.5 first:border-t-0 max-lg:px-0">
      <BoxDot online={box.online} />
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-neutral-100">{label}</span>
      <HealthBadge level={level} />
      {unread.locked && <Badge title="Este aparelho não está cadastrado nesta máquina">sem acesso</Badge>}
      {unread.red > 0 && <Badge tone="red">{unread.red} aguardando</Badge>}
      {unread.white > 0 && <Badge tone="orange">{unread.white} {unread.white > 1 ? 'novidades' : 'novidade'}</Badge>}
      {active
        ? <Badge tone="green">atual</Badge>
        : <Button size="sm" variant="secondary" onClick={onOpen} aria-label={`Trocar para ${label}`}>Usar</Button>}
      <IconButton icon="pencil" label={`Renomear ${label}`} size="sm" onClick={onRename} />
      <IconButton icon="trash" label={`Remover ${label}`} size="sm" onClick={onRevoke} />
    </li>
  );
}
