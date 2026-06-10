import type { CompactMessage } from '../../data/mock';
import { Icon } from '../primitives';
import { fmtTokens } from './message-format';

// Divisor inline marcando onde o CLI auto-compactou o contexto (DR-012). O
// histórico pré-compactação não some — fica em "ver tudo".
export function CompactDivider({ msg }: { msg: CompactMessage }) {
  const manual = msg.trigger === 'manual';
  const detail = msg.preTokens ? `${fmtTokens(msg.preTokens)} tokens resumidos` : 'contexto resumido';
  return (
    <div className="fade-up my-1 flex items-center gap-2 px-1" title="O histórico anterior continua em “ver tudo”">
      <span className="h-px flex-1 bg-neutral-800" />
      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-0.5 text-[10px] font-medium text-neutral-400">
        <Icon name="sparkles" size={11} />
        {manual ? 'Conversa compactada' : 'Conversa compactada automaticamente'}
        <span className="text-neutral-600">· {detail}</span>
      </span>
      <span className="h-px flex-1 bg-neutral-800" />
    </div>
  );
}
