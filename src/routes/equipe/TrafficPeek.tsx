import { Button } from '../../components/primitives';
import { QuoteButton } from '../../components/chat/MessageActions';
import { Mascot } from '../../components/team/Mascot';
import { fmtClock } from '../../components/chat/message-format';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';

interface TrafficPeekProps {
  items: TeamMessage[];
  botId: string;
  byId: Map<string, TeamBot>;
  onOpen: (peerId: string) => void;
  onQuote?: (text: string) => void;
}

export function TrafficPeek({ items, botId, byId, onOpen, onQuote }: TrafficPeekProps) {
  const shown = items.slice(-3);
  const hidden = items.length - shown.length;
  return (
    <ul className="mt-1.5 flex w-full max-w-md flex-col gap-1.5">
      {shown.map((m) => {
        const sender = byId.get(m.from);
        const peerId = m.from === botId ? m.to : m.from;
        return (
          <li key={m.id} className="rounded-lg border border-neutral-800 bg-neutral-950/70 px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px]">
              {sender ? <Mascot mascot={sender.mascot} size={12} name={sender.name} /> : null}
              <span className="font-medium" style={{ color: sender?.mascot.color }}>{sender?.name ?? m.from}</span>
              <time className="tabular-nums text-neutral-600">{fmtClock(m.ts)}</time>
              <span className="ml-auto flex items-center gap-0.5">
                {onQuote && <QuoteButton onClick={() => onQuote(m.text)} />}
                <Button variant="ghost" size="xs" onClick={() => onOpen(peerId)}>abrir</Button>
              </span>
            </div>
            <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-[12.5px] leading-snug text-neutral-300">{m.text}</p>
          </li>
        );
      })}
      {hidden > 0 && (
        <li className="px-1 text-[11px] text-neutral-600">+{hidden} anteriores — abre a conversa pra ver o resto</li>
      )}
    </ul>
  );
}
