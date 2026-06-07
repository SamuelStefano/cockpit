import { Icon } from '../primitives';
import type { IconName } from '../primitives/Icon';
import { ClaudeAvatar, UserAvatar } from '../Avatar';
import type { Message } from '../../data/mock';
import type { TriageAction } from '../../../shared/protocol';
import { messageToText } from '../../lib/export';
import { AssistantBlocks } from './AssistantBlocks';
import { CopyTextButton, QuoteButton, CopyMessageButton } from './MessageActions';

export type { DiffRow } from './diff';
export { lineDiff } from './diff';
export { Thinking } from './Thinking';

interface MessageRowProps {
  msg: Message;
  caretOnLast: boolean;
  onEditUser?: (text: string) => void;
  onQuote?: (text: string) => void;
}

export function MessageRow({ msg, caretOnLast, onEditUser, onQuote }: MessageRowProps) {
  if (msg.role === 'user') {
    return (
      <div className="fade-up group/u flex items-start justify-end gap-2.5">
        <div className="mt-1 flex shrink-0 items-center gap-0.5 opacity-100 transition group-hover/u:opacity-100 sm:opacity-0 sm:group-hover/u:opacity-100">
          {msg.ts && <time className="mr-1 text-[10px] tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
          <CopyTextButton text={msg.text} />
          {onQuote && <QuoteButton onClick={() => onQuote(msg.text)} />}
          {onEditUser && (
            <button
              onClick={() => onEditUser(msg.text)}
              title="Editar e reenviar"
              className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-800 hover:text-neutral-300"
            >
              <Icon name="pencil" size={12} />
            </button>
          )}
        </div>
        <div className="flex max-w-[82%] flex-col items-end gap-1">
          <div className="w-full whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-neutral-700/60 bg-neutral-800 px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-100 shadow-sm shadow-black/20">
            {msg.text}
          </div>
          {msg.triage && <TriageBadge action={msg.triage.action} reason={msg.triage.reason} />}
        </div>
        <div className="mt-0.5">
          <UserAvatar size={28} />
        </div>
      </div>
    );
  }
  const hasText = msg.blocks.some((b) => b.type === 'text' || b.type === 'code');
  return (
    <div className="fade-up group/msg flex gap-2.5">
      <div className="mt-0.5">
        <ClaudeAvatar size={28} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {msg.quick && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
            <Icon name="zap" size={10} /> resposta rápida (paralela)
          </div>
        )}
        <AssistantBlocks blocks={msg.blocks} caretOnLast={caretOnLast} />
        {hasText && !caretOnLast && (
          <div className="mt-1 flex items-center gap-2 opacity-100 transition group-hover/msg:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100">
            <CopyMessageButton blocks={msg.blocks} />
            {onQuote && <QuoteButton onClick={() => onQuote(messageToText(msg.blocks))} withLabel />}
            {msg.ts && <time className="text-[10px] tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
          </div>
        )}
      </div>
    </div>
  );
}

// Selo da triagem sob a bolha do usuário (prompt enviado com o turno ocupado).
const TRIAGE_META: Record<TriageAction, { icon: IconName; label: string; cls: string }> = {
  wait: { icon: 'clock', label: 'na fila', cls: 'bg-amber-500/15 text-amber-300' },
  answer: { icon: 'zap', label: 'resposta rápida', cls: 'bg-sky-500/15 text-sky-300' },
  priority: { icon: 'arrowUp', label: 'priorizado', cls: 'bg-rose-500/15 text-rose-300' },
  merge: { icon: 'sparkles', label: 'juntado ao anterior', cls: 'bg-violet-500/15 text-violet-300' },
};

function TriageBadge({ action, reason }: { action: TriageAction; reason: string }) {
  const m = TRIAGE_META[action];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`} title={reason}>
      <Icon name={m.icon} size={10} /> {m.label}
    </span>
  );
}

// Horário do turno (HH:MM). Mostra dia quando não é hoje.
function fmtClock(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${hm}`;
}
