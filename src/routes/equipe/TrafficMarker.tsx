import type { TeamBot } from '../../../shared/protocol';
import type { TrafficGroup } from '../../../shared/team-messages';
import { TrafficChip } from './TrafficChip';
import { TrafficSeparator } from './TrafficSeparator';

interface TrafficMarkerProps {
  group: TrafficGroup;
  botId: string;
  byId: Map<string, TeamBot>;
  onOpen: (peerId: string) => void;
  onQuote?: (text: string) => void;
}

export function TrafficMarker({ group, botId, byId, onOpen, onQuote }: TrafficMarkerProps) {
  if (group.items.length === 1) {
    const m = group.items[0];
    const peerId = m.from === botId ? m.to : m.from;
    return <TrafficChip message={m} outgoing={m.from === botId} peer={byId.get(peerId)} peerId={peerId} onOpen={onOpen} onQuote={onQuote} />;
  }
  return (
    <TrafficSeparator
      count={group.items.length}
      peers={group.peers.map((id) => ({ id, bot: byId.get(id) }))}
      items={group.items}
      botId={botId}
      byId={byId}
      onOpen={onOpen}
      onQuote={onQuote}
    />
  );
}
