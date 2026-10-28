import { useState } from 'react';
import { Icon } from '../../components/primitives';
import { MascotStack } from '../../components/team/MascotStack';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { TrafficPeek } from './TrafficPeek';
import { trafficLabel, trafficParticipants } from './team-thread';

interface TrafficSeparatorProps {
  items: TeamMessage[];
  byId: Map<string, TeamBot>;
  onQuote?: (text: string) => void;
}

export function TrafficSeparator({ items, byId, onQuote }: TrafficSeparatorProps) {
  const [open, setOpen] = useState(false);
  const people = trafficParticipants(items).map((id) => ({ id, bot: byId.get(id) }));
  const stack = people.flatMap((p) => (p.bot ? [{ id: p.id, mascot: p.bot.mascot, name: p.bot.name }] : []));
  const label = trafficLabel(items.length, people.map((p) => p.bot?.name ?? p.id));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex w-full items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-neutral-800" />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 py-1 pl-1.5 pr-2.5 text-[12px] text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
        >
          <MascotStack mascots={stack} size={24} />
          <span className="truncate">{label}</span>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={12} />
        </button>
        <span aria-hidden="true" className="h-px flex-1 bg-neutral-800" />
      </div>
      {open && <TrafficPeek items={items} byId={byId} onQuote={onQuote} />}
    </div>
  );
}
