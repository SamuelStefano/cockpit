import type { CompactMessage } from '../../data/mock';
import { Icon } from '../primitives';
import { fmtTokens } from './message-format';

// Divisor inline marcando onde o CLI auto-compactou o contexto (DR-012). O
// histórico pré-compactação não some — fica em "ver tudo".
export function CompactDivider({ msg }: { msg: CompactMessage }) {
  const manual = msg.trigger === 'manual';
  const detail = msg.preTokens ? `${fmtTokens(msg.preTokens)} tokens resumidos` : 'contexto resumido';
  // O mesmo divisor fino marca compactação, wakeup de loop agendado e PR aberta
  // (kind) — paridade com as linhas avulsas que o terminal imprime.
  const body = msg.kind === 'wakeup' ? (
    <><Icon name="zap" size={11} className="text-violet-400/80" />{msg.label ?? 'Claude retomou um loop agendado'}</>
  ) : msg.kind === 'pr' ? (
    <>
      <Icon name="arrowUp" size={11} className="text-orange-400/80" />
      {msg.url ? (
        <a href={msg.url} target="_blank" rel="noreferrer" className="underline decoration-neutral-600 underline-offset-2 transition hover:text-orange-300">
          {msg.label ?? msg.url}
        </a>
      ) : (msg.label ?? 'PR aberta')}
    </>
  ) : (
    <>
      <Icon name="sparkles" size={11} />
      {manual ? 'Conversa compactada' : 'Conversa compactada automaticamente'}
      <span className="text-neutral-600">· {detail}</span>
    </>
  );
  return (
    <div className="fade-up my-1 flex items-center gap-2 px-1" title={msg.kind ? undefined : 'O histórico anterior continua em “ver tudo”'}>
      <span className="h-px flex-1 bg-neutral-800" />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-0.5 text-[10px] font-medium text-neutral-400">
        {body}
      </span>
      <span className="h-px flex-1 bg-neutral-800" />
    </div>
  );
}
