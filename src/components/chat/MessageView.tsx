import { memo } from 'react';
import { Icon } from '../primitives';
import { ClaudeAvatar } from '../ClaudeAvatar';
import type { Message } from '../../data/mock';
import type { TurnBubbleStats } from '../../../shared/protocol';
import { messageToText } from '../../lib/export';
import { usePersisted } from '../../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT } from '../../lib/prefs';
import { hasVisibleAssistantContent } from './visible-blocks';
import { AssistantBlocks } from './AssistantBlocks';
import { ThinkingDots, LiveStatsLine, type LiveTurn } from './Thinking';
import { QuoteButton, CopyMessageButton } from './MessageActions';
import { UserMessageRow } from './UserMessageRow';
import { CompactDivider } from './CompactDivider';
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
  onOpenAttachment?: (path: string, name: string) => void;
  attThumbs?: Record<string, string>;
  onAttThumb?: (path: string) => void;
}

// memo: cada delta de streaming troca só a referência da ÚLTIMA mensagem
// (patchRunMsg usa .map preservando as demais) — sem isto a thread inteira
// re-renderiza a cada chunk.
export const MessageRow = memo(function MessageRow({ msg, caretOnLast, modelLabel, thinking, live, onEditUser, onQuote, answerable, onAnswer, onOpenAttachment, attThumbs, onAttThumb }: MessageRowProps) {
  const [showTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);
  if (msg.role === 'user') {
    return <UserMessageRow msg={msg} onEditUser={onEditUser} onQuote={onQuote} onOpenAttachment={onOpenAttachment} attThumbs={attThumbs} onAttThumb={onAttThumb} />;
  }
  if (msg.role === 'compact') {
    return <CompactDivider msg={msg} />;
  }
  // Tools ocultas podem deixar a mensagem sem NENHUM bloco renderizável — aí a
  // linha inteira some, senão sobrava um rótulo "opus…" órfão por mensagem de
  // ferramenta. Exceção: a linha do indicador de turno em curso (thinking).
  if (!thinking && !hasVisibleAssistantContent(msg.blocks, showTools)) return null;
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
});

// Stat discreta do turno sob a bolha: tokens · tempo · custo. Ground-truth do
// result do CLI (#185) — ajuda a entender o que cada prompt gastou de verdade.
function TurnStatsLine({ stats }: { stats: TurnBubbleStats }) {
  const parts: string[] = [];
  // O total (stats.tokens) inclui cache read/creation — é o que consome a quota.
  // input_tokens sozinho é minúsculo (o grosso do prompt entra como cache) e já
  // enganou: a bolha mostrava "200 in" enquanto o turno queimava dezenas de k.
  if (stats.tokens) {
    parts.push(`${fmtTokens(stats.tokens)} tokens`);
  } else if (stats.inputTokens !== undefined && stats.outputTokens !== undefined) {
    parts.push(`${fmtTokens(stats.inputTokens)} in · ${fmtTokens(stats.outputTokens)} out`);
  }
  if (stats.durationMs) parts.push(fmtDuration(stats.durationMs));
  if (typeof stats.costUsd === 'number') parts.push(`$${stats.costUsd < 0.01 ? stats.costUsd.toFixed(4) : stats.costUsd.toFixed(3)}`);
  if (!parts.length) return null;
  const inOut = stats.inputTokens !== undefined && stats.outputTokens !== undefined
    ? ` — ${fmtTokens(stats.inputTokens)} in · ${fmtTokens(stats.outputTokens)} out (sem cache)`
    : '';
  return (
    <span className="text-[10px] tabular-nums text-neutral-600" title={`Gasto do turno: total faturável incl. cache · tempo · custo${inOut}`}>
      {parts.join(' · ')}
    </span>
  );
}
