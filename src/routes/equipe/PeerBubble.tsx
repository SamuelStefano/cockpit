import { Badge } from '../../components/primitives';
import { CopyTextButton, QuoteButton } from '../../components/chat/MessageActions';
import { Mascot } from '../../components/team/Mascot';
import type { TeamBot } from '../../../shared/protocol';
import type { TeamMessage } from '../../../shared/team-messages';
import { fmtClock } from '../../components/chat/message-format';

const STATUS: Partial<Record<TeamMessage['status'], { tone: 'red' | 'yellow'; label: string }>> = {
  blocked: { tone: 'red', label: 'bloqueada' },
  queued: { tone: 'yellow', label: 'na fila' },
  failed: { tone: 'red', label: 'não entregue' },
};

interface PeerBubbleProps {
  message: TeamMessage;
  sender: TeamBot | undefined;
  onQuote?: (text: string) => void;
}

export function PeerBubble({ message, sender, onQuote }: PeerBubbleProps) {
  const status = STATUS[message.status];
  return (
    <div className="group/peer flex items-end gap-2">
      {sender ? <Mascot mascot={sender.mascot} size={22} name={sender.name} /> : <span className="w-[22px]" />}
      <div className="min-w-0 max-w-[85%]">
        <div className="mb-0.5 flex items-center gap-1.5 px-1 text-[13px]">
          <span className="font-medium" style={{ color: sender?.mascot.color }}>{sender?.name ?? message.from}</span>
          <time className="tabular-nums text-neutral-600">{fmtClock(message.ts)}</time>
          {status && <Badge tone={status.tone} title={message.reason}>{status.label}{message.reason ? ` · ${message.reason}` : ''}</Badge>}
        </div>
        <div className="whitespace-pre-wrap break-words rounded-2xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-200">
          {message.text}
        </div>
      </div>
      <div className="mb-1 flex items-center gap-0.5 opacity-100 transition sm:pointer-fine:opacity-0 sm:focus-within:opacity-100 sm:group-hover/peer:opacity-100">
        {onQuote && <QuoteButton onClick={() => onQuote(message.text)} />}
        <CopyTextButton text={message.text} />
      </div>
    </div>
  );
}
