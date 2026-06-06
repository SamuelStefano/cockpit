import { Icon } from '../primitives';
import { ClaudeAvatar, UserAvatar } from '../Avatar';
import type { Message } from '../../data/mock';
import { messageToText } from '../../lib/export';
import { AssistantBlocks } from './AssistantBlocks';
import type { ToolSignal } from './ToolCallCard';
import { CopyTextButton, QuoteButton, CopyMessageButton } from './MessageActions';

export type { ToolSignal } from './ToolCallCard';
export type { DiffRow } from './diff';
export { lineDiff } from './diff';
export { Thinking } from './Thinking';

interface MessageRowProps {
  msg: Message;
  caretOnLast: boolean;
  onEditUser?: (text: string) => void;
  onQuote?: (text: string) => void;
  toolSignal?: ToolSignal;
}

export function MessageRow({ msg, caretOnLast, onEditUser, onQuote, toolSignal }: MessageRowProps) {
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
        <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-neutral-700/60 bg-neutral-800 px-3.5 py-2.5 text-[14px] leading-relaxed text-neutral-100 shadow-sm shadow-black/20">
          {msg.text}
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
        <AssistantBlocks blocks={msg.blocks} caretOnLast={caretOnLast} toolSignal={toolSignal} />
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

// Horário do turno (HH:MM). Mostra dia quando não é hoje.
function fmtClock(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return hm;
  return `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${hm}`;
}
