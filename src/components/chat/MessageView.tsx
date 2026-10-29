import { memo, type ReactNode } from 'react';
import { Icon } from '../primitives';
import { Bit } from '../bit/Bit';
import type { BitState } from '../bit/bit-state';
import type { TurnBubbleStats } from '../../../shared/protocol';
import { messageToText } from '../../lib/export';
import { usePersisted } from '../../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT } from '../../lib/prefs';
import { hasVisibleAssistantContent } from './visible-blocks';
import { AssistantBlocks } from './AssistantBlocks';
import type { LiveTurn } from './Thinking';
import { LiveLine } from './LiveLine';
import { QuoteButton, CopyMessageButton, RegenerateButton, SpeakButton, MemorizeButton } from './MessageActions';
import { MessageActionsHost } from './MessageActionsHost';
import { UserMessageRow } from './UserMessageRow';
import { CompactDivider } from './CompactDivider';
import { ActivityRow } from './ActivityRow';
import { NarrationGroupCard } from './NarrationGroupCard';
import type { ShownMessage } from './shown';
import { fmtTokens, fmtDuration, fmtClock } from './message-format';

export type { DiffRow } from './diff';
export { Thinking } from './Thinking';

interface MessageRowProps {
  msg: ShownMessage;
  avatar?: ReactNode;
  // Only the live turn's bubble gets a state; older bubbles keep a frozen Bit.
  bit?: BitState;
  caretOnLast: boolean;
  modelLabel?: string;
  showModelLabel?: boolean;
  thinking?: boolean;
  live?: LiveTurn;
  onEditUser?: (id: string, text: string) => void;
  onQuote?: (text: string) => void;
  onMemorize?: (text: string) => void;
  answerable?: boolean;
  onAnswer?: (text: string) => void;
  reviewable?: boolean;
  onApproveWorkflow?: (text: string) => void;
  // Só na última resposta com a sessão ociosa: reenvia o último prompt.
  onRegenerate?: () => void;
  onOpenAttachment?: (path: string, name: string) => void;
  attThumbs?: Record<string, string>;
  onAttThumb?: (path: string) => void;
}

// memo: cada delta de streaming troca só a referência da ÚLTIMA mensagem
// (patchRunMsg usa .map preservando as demais) — sem isto a thread inteira
// re-renderiza a cada chunk.
export const MessageRow = memo(function MessageRow({ msg, avatar, bit, caretOnLast, modelLabel, showModelLabel = true, thinking, live, onEditUser, onQuote, onMemorize, answerable, onAnswer, reviewable, onApproveWorkflow, onRegenerate, onOpenAttachment, attThumbs, onAttThumb }: MessageRowProps) {
  const [showTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);
  if (msg.role === 'user') {
    return <UserMessageRow msg={msg} onEditUser={onEditUser} onQuote={onQuote} onOpenAttachment={onOpenAttachment} attThumbs={attThumbs} onAttThumb={onAttThumb} />;
  }
  if (msg.role === 'compact') {
    return <CompactDivider msg={msg} />;
  }
  // Todas as ferramentas do turno numa caixa fechada só (sem avatar nem rótulo
  // de modelo): a thread fica prompt + resposta, e o que a IA fez pra chegar lá
  // continua a um clique.
  if (msg.digest) {
    return (
      <div data-mid={msg.id} className="fade-up">
        <ActivityRow tools={msg.digest} />
        {thinking && <LiveLine live={live} bit={bit} />}
      </div>
    );
  }
  // Mesma ideia da caixa de ferramentas, pro texto de bastidor: o turno narra o
  // que vai fazer dezenas de vezes e só a última fala é a resposta.
  if (msg.narration) {
    return (
      <div data-mid={msg.id} className="fade-up">
        <NarrationGroupCard notes={msg.narration} />
        {thinking && <LiveLine live={live} bit={bit} />}
      </div>
    );
  }
  // Tools ocultas podem deixar a mensagem sem NENHUM bloco renderizável — aí a
  // linha inteira some, senão sobrava um rótulo "opus…" órfão por mensagem de
  // ferramenta. Exceções: o indicador de turno em curso (thinking) e o fecho de um
  // turno que só usou ferramentas, onde só resta o "Pensou por X".
  if (!thinking && !msg.stats?.durationMs && !hasVisibleAssistantContent(msg.blocks, showTools)) return null;
  const hasText = msg.blocks.some((b) => b.type === 'text' || b.type === 'code');
  return (
    // data-mid em toda linha (não só nas do usuário): é a âncora que o
    // "carregar antigas" usa pra reposicionar o scroll. Uma resposta longa pode
    // ocupar a viewport inteira — sem âncora ali, a leitura saltava.
    <div data-mid={msg.id} className="fade-up group/msg flex flex-col gap-2">
      {showModelLabel && (
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-neutral-300">
          {avatar ?? <Bit state={bit ?? 'idle'} still={!bit} size={24} />}
          <span className="max-w-[260px] truncate">{modelLabel || 'Claude'}</span>
        </div>
      )}
      <MessageActionsHost className="min-w-0 flex-1" spec={{ text: hasText ? messageToText(msg.blocks) : '', speak: true, onRegenerate, onQuote, onMemorize }}>
        {msg.quick && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[12px] font-medium text-sky-300">
            <Icon name="zap" size={10} /> resposta rápida (paralela)
          </div>
        )}
        <AssistantBlocks blocks={msg.blocks} caretOnLast={caretOnLast} answerable={answerable} onAnswer={onAnswer} reviewable={reviewable} onApproveWorkflow={onApproveWorkflow} />
        {thinking && <LiveLine live={live} bit={bit} avatar={avatar} bare={showModelLabel} />}
        {!caretOnLast && !thinking && msg.stats?.durationMs ? <ThoughtFor ms={msg.stats.durationMs} /> : null}
        {hasText && !caretOnLast && (
          <div className="-ml-1.5 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 opacity-100 transition max-[719px]:hidden pointer-coarse:hidden sm:pointer-fine:opacity-0 sm:focus-within:opacity-100 sm:group-hover/msg:opacity-100">
            <div className="flex flex-wrap items-center gap-x-2">
              <CopyMessageButton blocks={msg.blocks} />
              <SpeakButton blocks={msg.blocks} />
              {onRegenerate && <RegenerateButton onClick={onRegenerate} />}
              {onQuote && <QuoteButton onClick={() => onQuote(messageToText(msg.blocks))} withLabel />}
              {onMemorize && <MemorizeButton onClick={() => onMemorize(messageToText(msg.blocks))} />}
            </div>
            {msg.stats && <TurnStatsLine stats={msg.stats} />}
            {msg.ts && <time className="whitespace-nowrap text-[12px] tabular-nums text-neutral-600">{fmtClock(msg.ts)}</time>}
          </div>
        )}
      </MessageActionsHost>
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
    <span className="whitespace-nowrap text-[12px] tabular-nums text-neutral-600" title={`Gasto do turno: total faturável incl. cache · custo${inOut}`}>
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
    <div className="mt-1 flex items-center gap-1.5 text-[12px] text-neutral-500" title="Tempo total deste turno (relógio do CLI)">
      <Icon name="clock" size={11} className="text-orange-400/70" />
      <span className="tabular-nums">Pensou por {fmtDuration(ms)}</span>
    </div>
  );
}
