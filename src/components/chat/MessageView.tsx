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
import { QuoteButton, CopyMessageButton, RegenerateButton, SpeakButton } from './MessageActions';
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
  showModelLabel?: boolean;
  thinking?: boolean;
  live?: LiveTurn;
  onEditUser?: (id: string, text: string) => void;
  onQuote?: (text: string) => void;
  answerable?: boolean;
  onAnswer?: (text: string) => void;
  // Só na última resposta com a sessão ociosa: reenvia o último prompt.
  onRegenerate?: () => void;
  onOpenAttachment?: (path: string, name: string) => void;
  attThumbs?: Record<string, string>;
  onAttThumb?: (path: string) => void;
}

// memo: cada delta de streaming troca só a referência da ÚLTIMA mensagem
// (patchRunMsg usa .map preservando as demais) — sem isto a thread inteira
// re-renderiza a cada chunk.
export const MessageRow = memo(function MessageRow({ msg, caretOnLast, modelLabel, showModelLabel = true, thinking, live, onEditUser, onQuote, answerable, onAnswer, onRegenerate, onOpenAttachment, attThumbs, onAttThumb }: MessageRowProps) {
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
  // Cabeçalho (avatar + rótulo do modelo) só na PRIMEIRA mensagem de uma sequência
  // do assistant — mensagens seguintes do mesmo turno alinham sem repetir o caranguejo
  // nem o rótulo laranja (o que deixava a thread poluída). Continuação encosta na
  // anterior (margem negativa) pra virar um bloco visual só.
  const showFooter = !caretOnLast && !thinking && (msg.stats?.durationMs || hasText);
  return (
    <div className={`group/msg flex gap-2.5 ${showModelLabel ? 'fade-up' : '-mt-3.5'}`}>
      <div className="w-7 shrink-0">
        {showModelLabel && <div className="mt-0.5"><ClaudeAvatar size={28} /></div>}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {showModelLabel && (
          <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_0_5px_rgba(249,115,22,0.5)]" />
            <span className="max-w-[260px] truncate font-mono text-[10.5px] font-medium tracking-tight text-neutral-400">{modelLabel || 'Claude'}</span>
          </div>
        )}
        {msg.quick && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
            <Icon name="zap" size={10} /> resposta rápida (paralela)
          </div>
        )}
        <AssistantBlocks blocks={msg.blocks} caretOnLast={caretOnLast} answerable={answerable} onAnswer={onAnswer} />
        {thinking && <ThinkingDots live={live} />}
        {showFooter && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-neutral-600">
            {hasText && (
              <div className="flex items-center gap-2 opacity-100 transition group-hover/msg:opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100">
                <CopyMessageButton blocks={msg.blocks} />
                <SpeakButton blocks={msg.blocks} />
                {onRegenerate && <RegenerateButton onClick={onRegenerate} />}
                {onQuote && <QuoteButton onClick={() => onQuote(messageToText(msg.blocks))} withLabel />}
              </div>
            )}
            {msg.stats?.durationMs ? <ThoughtFor ms={msg.stats.durationMs} /> : null}
            {hasText && msg.stats && <TurnStatsLine stats={msg.stats} />}
            {hasText && msg.ts && <time className="whitespace-nowrap tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
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
  // O total (stats.tokens) = trabalho novo do turno (input + cache creation + output); cache read fica de fora.
  // input_tokens sozinho é minúsculo (o grosso do prompt entra como cache) e já
  // enganou: a bolha mostrava "200 in" enquanto o turno queimava dezenas de k.
  if (stats.tokens) {
    parts.push(`${fmtTokens(stats.tokens)} tokens`);
  } else if (stats.inputTokens !== undefined && stats.outputTokens !== undefined) {
    parts.push(`${fmtTokens(stats.inputTokens)} in · ${fmtTokens(stats.outputTokens)} out`);
  }
  if (typeof stats.costUsd === 'number') parts.push(`$${stats.costUsd < 0.01 ? stats.costUsd.toFixed(4) : stats.costUsd.toFixed(3)}`);
  if (!parts.length) return null;
  const inOut = stats.inputTokens !== undefined && stats.outputTokens !== undefined
    ? ` — ${fmtTokens(stats.inputTokens)} in · ${fmtTokens(stats.outputTokens)} out`
    : '';
  return (
    <span className="whitespace-nowrap text-[10px] tabular-nums text-neutral-600" title={`Gasto do turno: total faturável incl. cache · custo${inOut}`}>
      {parts.join(' · ')}
    </span>
  );
}

// Tempo final do turno, estilo terminal ("pensou por X"). Fica logo abaixo da
// resposta assim que o turno conclui — aparece mesmo em turnos só de ferramenta
// (o gasto tokens/custo some quando não há texto, mas o tempo sempre fica).
// Fonte: stats.durationMs = duration_ms do result do CLI (relógio do turno).
function ThoughtFor({ ms }: { ms: number }) {
  return (
    <span className="flex items-center gap-1.5 text-neutral-500" title="Tempo total deste turno (relógio do CLI)">
      <span className="text-orange-400/70" aria-hidden>✻</span>
      <span className="tabular-nums">Pensou por {fmtDuration(ms)}</span>
    </span>
  );
}
