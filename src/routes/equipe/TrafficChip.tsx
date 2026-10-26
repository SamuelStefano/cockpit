import { useState } from 'react';
import { Badge, Button, Icon } from '../../components/primitives';
import { QuoteButton } from '../../components/chat/MessageActions';
import { Mascot } from '../../components/team/Mascot';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { messageSnippet } from './team-thread';

interface TrafficChipProps {
  message: TeamMessage;
  outgoing: boolean;
  peer: TeamBot | undefined;
  peerId: string;
  onOpen: (peerId: string) => void;
  onQuote?: (text: string) => void;
}

export function TrafficChip({ message, outgoing, peer, peerId, onOpen, onQuote }: TrafficChipProps) {
  const [open, setOpen] = useState(false);
  const snippet = messageSnippet(message.text);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1.5">
        {message.status === 'blocked' && <Badge tone="red" title={message.reason}>bloqueada</Badge>}
        {message.status === 'queued' && <Badge tone="yellow">na fila</Badge>}
        {message.status === 'failed' && <Badge tone="red" title={message.reason}>não entregue</Badge>}
        <Button variant="ghost" size="xs" onClick={() => onOpen(peerId)} title={message.text.slice(0, 200)}>
          <span className="inline-flex items-center gap-1">
            {outgoing ? 'Mandou para' : 'Mensagem de'}
            <Icon name="chevronRight" size={11} />
            {peer && <Mascot mascot={peer.mascot} size={14} name={peer.name} />}
            <span className="text-neutral-300">{peer?.name ?? peerId}</span>
          </span>
        </Button>
        <Button
          variant="ghost"
          size="xs"
          square
          icon={open ? 'chevronUp' : 'chevronDown'}
          aria-expanded={open}
          aria-label={open ? 'Recolher mensagem' : 'Ver mensagem'}
          onClick={() => setOpen((v) => !v)}
        />
      </div>
      {open ? (
        <div className="max-w-md rounded-lg border border-neutral-800 bg-neutral-950/70 px-2.5 py-1.5">
          <p className="whitespace-pre-wrap break-words text-[12.5px] leading-snug text-neutral-300">{message.text}</p>
          {onQuote && <div className="mt-1 flex justify-end"><QuoteButton onClick={() => onQuote(message.text)} withLabel /></div>}
        </div>
      ) : snippet ? (
        <p className="max-w-md truncate text-[11px] text-neutral-600">{snippet}</p>
      ) : null}
    </div>
  );
}
