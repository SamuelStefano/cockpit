import { Badge, Button, Icon } from '../../components/primitives';
import { Mascot } from '../../components/team/Mascot';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';

interface TrafficChipProps { message: TeamMessage; outgoing: boolean; peer: TeamBot | undefined; peerId: string; onOpen: (peerId: string) => void }

export function TrafficChip({ message, outgoing, peer, peerId, onOpen }: TrafficChipProps) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {message.status === 'blocked' && <Badge tone="red" title={message.reason}>bloqueada</Badge>}
      {message.status === 'queued' && <Badge tone="yellow">na fila</Badge>}
      {message.status === 'failed' && <Badge tone="red" title={message.reason}>não entregue</Badge>}
      <Button variant="ghost" size="xs" onClick={() => onOpen(peerId)} title={message.text.slice(0, 200)}>
        {outgoing ? 'Mandou para' : 'Mensagem de'}
        <Icon name="chevronRight" size={11} />
        {peer && <Mascot mascot={peer.mascot} size={14} name={peer.name} />}
        <span className="text-neutral-300">{peer?.name ?? peerId}</span>
      </Button>
    </div>
  );
}
