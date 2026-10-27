import type { TeamBot } from '../../../shared/protocol';
import type { TrafficGroup } from '../../../shared/team-messages';
import { TrafficSeparator } from './TrafficSeparator';

interface TrafficMarkerProps {
  group: TrafficGroup;
  byId: Map<string, TeamBot>;
  onQuote?: (text: string) => void;
}

export function TrafficMarker({ group, byId, onQuote }: TrafficMarkerProps) {
  return <TrafficSeparator items={group.items} byId={byId} onQuote={onQuote} />;
}
