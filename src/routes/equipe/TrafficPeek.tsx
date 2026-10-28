import { Badge } from '../../components/primitives';
import { QuoteButton } from '../../components/chat/MessageActions';
import { Mascot } from '../../components/team/Mascot';
import { fmtClock } from '../../components/chat/message-format';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';

interface TrafficPeekProps {
  items: TeamMessage[];
  byId: Map<string, TeamBot>;
  onQuote?: (text: string) => void;
}

export function TrafficPeek({ items, byId, onQuote }: TrafficPeekProps) {
  return (
    <ul className="flex w-full max-w-md flex-col gap-1.5">
      {items.map((m) => {
        const sender = byId.get(m.from);
        const receiver = byId.get(m.to);
        return (
          <li key={m.id} className="rounded-lg border border-neutral-800 bg-neutral-950/70 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[12px]">
              {sender ? <Mascot mascot={sender.mascot} size={14} name={sender.name} /> : null}
              <span className="font-medium" style={{ color: sender?.mascot.color }}>{sender?.name ?? m.from}</span>
              <span className="text-neutral-600">para</span>
              <span className="text-neutral-300">{receiver?.name ?? m.to}</span>
              <time className="tabular-nums text-neutral-600">{fmtClock(m.ts)}</time>
              <span className="ml-auto flex items-center gap-1">
                {m.status === 'blocked' && <Badge tone="red" title={m.reason}>bloqueada</Badge>}
                {m.status === 'queued' && <Badge tone="yellow">na fila</Badge>}
                {m.status === 'failed' && <Badge tone="red" title={m.reason}>não entregue</Badge>}
                {onQuote && <QuoteButton onClick={() => onQuote(m.text)} />}
              </span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-snug text-neutral-300">{m.text}</p>
          </li>
        );
      })}
    </ul>
  );
}
