import { Icon } from '../primitives';
import { ClaudeAvatar } from '../ClaudeAvatar';
import type { Message } from '../../data/mock';
import type { TurnBubbleStats } from '../../../shared/protocol';
import { messageToText } from '../../lib/export';
import { AssistantBlocks } from './AssistantBlocks';
import { ThinkingDots, LiveStatsLine, type LiveTurn } from './Thinking';
import { QuoteButton, CopyMessageButton } from './MessageActions';
import { UserMessageRow } from './UserMessageRow';
import { fmtTokens, fmtDuration, fmtClock } from './message-format';

export type { DiffRow } from './diff';
export { lineDiff } from './diff';
export { Thinking } from './Thinking';

interface MessageRowProps {
  msg: Message;
  caretOnLast: boolean;
  modelLabel?: string;
  thinking?: boolean;
  live?: LiveTurn;
  onEditUser?: (id: string, text: string) => void;
  onQuote?: (text: string) => void;
  answerable?: boolean;
  onAnswer?: (text: string) => void;
}

export function MessageRow({ msg, caretOnLast, modelLabel, thinking, live, onEditUser, onQuote, answerable, onAnswer }: MessageRowProps) {
  if (msg.role === 'user') {
    return <UserMessageRow msg={msg} onEditUser={onEditUser} onQuote={onQuote} />;
  }
  const hasText = msg.blocks.some((b) => b.type === 'text' || b.type === 'code');
  return (
    <div className="fade-up group/msg flex gap-2.5">
      <div className="mt-0.5">
        <ClaudeAvatar size={28} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <span className="mb-0.5 block max-w-[260px] truncate px-0.5 text-[11px] font-medium text-orange-300/80">{modelLabel || 'Claude'}</span>
        {msg.quick && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
            <Icon name="zap" size={10} /> resposta rápida (paralela)
          </div>
        )}
        <AssistantBlocks blocks={msg.blocks} caretOnLast={caretOnLast} answerable={answerable} onAnswer={onAnswer} />
        {thinking && <ThinkingDots live={live} />}
        {hasText && !caretOnLast && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-2 opacity-100 transition group-hover/msg:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100">
              <CopyMessageButton blocks={msg.blocks} />
              {onQuote && <QuoteButton onClick={() => onQuote(messageToText(msg.blocks))} withLabel />}
            </div>
            {msg.stats && <TurnStatsLine stats={msg.stats} />}
            {msg.ts && <time className="text-[10px] tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
          </div>
        )}
      </div>
    </div>
  );
}

// Stat discreta do turno sob a bolha: tokens · tempo · custo. Ground-truth do
// result do CLI (#185) — ajuda a entender o que cada prompt gastou de verdade.
function TurnStatsLine({ stats }: { stats: TurnBubbleStats }) {
  const parts: string[] = [];
  if (stats.inputTokens !== undefined && stats.outputTokens !== undefined) {
    parts.push(`${fmtTokens(stats.inputTokens)} in · ${fmtTokens(stats.outputTokens)} out`);
  } else if (stats.tokens) {
    parts.push(`${fmtTokens(stats.tokens)} tokens`);
  }
  if (stats.durationMs) parts.push(fmtDuration(stats.durationMs));
  if (typeof stats.costUsd === 'number') parts.push(`$${stats.costUsd < 0.01 ? stats.costUsd.toFixed(4) : stats.costUsd.toFixed(3)}`);
  if (!parts.length) return null;
  return (
    <span className="text-[10px] tabular-nums text-neutral-600" title="Gasto do turno (tokens faturáveis · tempo · custo)">
      {parts.join(' · ')}
    </span>
  );
}
