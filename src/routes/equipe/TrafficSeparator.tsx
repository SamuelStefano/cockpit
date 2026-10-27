import { useState } from 'react';
import { Button } from '../../components/primitives';
import { MascotStack } from '../../components/team/MascotStack';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { TrafficPeek } from './TrafficPeek';

interface TrafficSeparatorProps {
  count: number;
  peers: { id: string; bot: TeamBot | undefined }[];
  items: TeamMessage[];
  botId: string;
  byId: Map<string, TeamBot>;
  onOpen: (peerId: string) => void;
  onQuote?: (text: string) => void;
}

export function TrafficSeparator({ count, peers, items, botId, byId, onOpen, onQuote }: TrafficSeparatorProps) {
  const [open, setOpen] = useState(false);
  const known = peers.flatMap((p) => (p.bot ? [{ id: p.id, mascot: p.bot.mascot, name: p.bot.name }] : []));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-1 text-[13px] text-neutral-500">
        <Button
          variant="ghost"
          size="xs"
          icon={open ? 'chevronUp' : 'chevronDown'}
          aria-expanded={open}
          aria-label={open ? 'Recolher mensagens' : 'Ver mensagens'}
          onClick={() => setOpen((v) => !v)}
        >
          {count} mensagens com
        </Button>
        <MascotStack mascots={known} />
        {peers.map((p, i) => (
          <span key={p.id} className="inline-flex items-center">
            {i > 0 && <span className="mr-1">{i === peers.length - 1 ? 'e' : ','}</span>}
            <Button variant="ghost" size="xs" onClick={() => onOpen(p.id)} aria-label={`Abrir conversa com ${p.bot?.name ?? p.id}`}>
              <span className="text-neutral-300">{p.bot?.name ?? p.id}</span>
            </Button>
          </span>
        ))}
      </div>
      {open && <TrafficPeek items={items} botId={botId} byId={byId} onOpen={onOpen} onQuote={onQuote} />}
    </div>
  );
}
